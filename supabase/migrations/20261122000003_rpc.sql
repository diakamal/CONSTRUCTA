-- Server-side business logic. Clients never write attendance/task completion directly.
-- Errors are raised with a stable machine code in MESSAGE and context in DETAIL,
-- so the apps can map them to translated strings.

-- ---------- Onboarding ----------

-- First sign-up of a contractor (email): creates the organization and an owner profile.
create or replace function public.create_organization(p_org_name text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'profile_exists';
  end if;
  insert into organizations (name) values (p_org_name) returning id into v_org;
  insert into profiles (id, org_id, role, full_name)
  values (auth.uid(), v_org, 'owner', p_full_name);
  return v_org;
end $$;

-- When a worker signs in with phone OTP for the first time, attach them to the inviting org.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype;
begin
  if new.phone is null or new.phone = '' then return new; end if;

  select * into inv from invitations
  where phone = normalize_phone(new.phone) and accepted_at is null
  order by created_at desc limit 1;

  if not found then return new; end if;   -- uninvited: app shows "contact your manager"

  insert into profiles (id, org_id, role, full_name, phone, language, team_id)
  values (new.id, inv.org_id, inv.role, inv.full_name, normalize_phone(new.phone), inv.language, inv.team_id)
  on conflict (id) do nothing;

  insert into project_members (project_id, profile_id)
  select unnest(inv.project_ids), new.id
  on conflict do nothing;

  update invitations set accepted_at = now() where id = inv.id;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.set_my_language(p_language app_language)
returns void language sql security definer set search_path = public as $$
  update profiles set language = p_language where id = auth.uid()
$$;

-- ---------- Attendance ----------

create or replace function public.check_in(
  p_project uuid, p_lat float8, p_lng float8, p_accuracy float8 default null)
returns attendance language plpgsql security definer set search_path = public as $$
declare
  prj      projects%rowtype;
  v_dist   float8;
  v_slack  float8 := least(coalesce(p_accuracy, 0), 50);  -- tolerate GPS error, capped at 50 m
  rec      attendance%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into prj from projects where id = p_project;
  if not found or prj.org_id is distinct from current_org_id() then
    raise exception 'project_not_found';
  end if;
  if prj.status <> 'active' then raise exception 'project_inactive'; end if;
  if not (is_project_member(p_project) or is_manager()) then
    raise exception 'not_project_member';
  end if;
  if exists (select 1 from attendance where profile_id = auth.uid() and check_out_at is null) then
    raise exception 'already_checked_in';
  end if;

  v_dist := distance_m(p_lat, p_lng, prj.lat, prj.lng);
  if v_dist > prj.radius_m + v_slack then
    raise exception 'outside_geofence' using detail = round(v_dist)::text;
  end if;

  insert into attendance (profile_id, project_id, check_in_lat, check_in_lng, check_in_accuracy)
  values (auth.uid(), p_project, p_lat, p_lng, p_accuracy)
  returning * into rec;
  return rec;
end $$;

-- Check-out is allowed from anywhere (a worker who forgot shouldn't be stuck); location is recorded.
create or replace function public.check_out(p_lat float8 default null, p_lng float8 default null)
returns attendance language plpgsql security definer set search_path = public as $$
declare rec attendance%rowtype;
begin
  update attendance
     set check_out_at = now(), check_out_lat = p_lat, check_out_lng = p_lng
   where profile_id = auth.uid() and check_out_at is null
  returning * into rec;
  if not found then raise exception 'not_checked_in'; end if;
  return rec;
end $$;

create or replace function public.edit_attendance(
  p_attendance uuid, p_check_in timestamptz, p_check_out timestamptz, p_reason text)
returns attendance language plpgsql security definer set search_path = public as $$
declare old_rec attendance%rowtype; rec attendance%rowtype;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;

  select * into old_rec from attendance where id = p_attendance for update;
  if not found or project_org(old_rec.project_id) is distinct from current_org_id() then
    raise exception 'attendance_not_found';
  end if;

  update attendance
     set check_in_at = p_check_in, check_out_at = p_check_out, source = 'manual'
   where id = p_attendance
  returning * into rec;

  insert into attendance_edits
    (attendance_id, old_check_in, old_check_out, new_check_in, new_check_out, reason, edited_by)
  values
    (p_attendance, old_rec.check_in_at, old_rec.check_out_at, p_check_in, p_check_out, p_reason, auth.uid());
  return rec;
end $$;

-- ---------- Tasks ----------

-- Marks a task done immediately (no manager approval), but only with an uploaded photo.
create or replace function public.complete_task(p_task uuid, p_photo_path text)
returns tasks language plpgsql security definer set search_path = public as $$
declare t tasks%rowtype; v_team uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into t from tasks where id = p_task for update;
  if not found or project_org(t.project_id) is distinct from current_org_id() then
    raise exception 'task_not_found';
  end if;

  select team_id into v_team from profiles where id = auth.uid();
  if not (is_manager()
          or (is_project_member(t.project_id)
              and (t.assignee_id = auth.uid() or (v_team is not null and t.team_id = v_team)))) then
    raise exception 'task_not_assigned';
  end if;

  if t.status = 'done' then return t; end if;  -- idempotent: safe to retry after a flaky network

  if p_photo_path is null
     or p_photo_path not like current_org_id()::text || '/' || p_task::text || '/%' then
    raise exception 'photo_required';
  end if;
  if not exists (select 1 from storage.objects
                 where bucket_id = 'task-photos' and name = p_photo_path and owner = auth.uid()) then
    raise exception 'photo_not_uploaded';
  end if;

  insert into task_photos (task_id, storage_path, uploaded_by)
  values (p_task, p_photo_path, auth.uid())
  on conflict (storage_path) do nothing;

  update tasks set status = 'done', completed_at = now(), completed_by = auth.uid()
   where id = p_task
  returning * into t;
  return t;
end $$;

-- ---------- Dashboard views (security_invoker => RLS of the caller applies) ----------

create view public.v_on_site_now with (security_invoker = true) as
select a.id as attendance_id, a.project_id, a.profile_id, p.full_name, p.team_id, a.check_in_at,
       extract(epoch from (now() - a.check_in_at)) / 3600.0 as hours_so_far
from public.attendance a
join public.profiles p on p.id = a.profile_id
where a.check_out_at is null;

-- Progress per location, counting every task in the location's subtree.
create view public.v_location_progress with (security_invoker = true) as
with recursive tree as (
  select id as ancestor_id, id as location_id from public.locations
  union all
  select tree.ancestor_id, l.id
  from tree join public.locations l on l.parent_id = tree.location_id
)
select l.id as location_id, l.project_id, l.parent_id, l.kind, l.name, l.sort,
       count(t.id)                                  as total_tasks,
       count(t.id) filter (where t.status = 'done') as done_tasks,
       case when count(t.id) = 0 then 0
            else round(100.0 * count(t.id) filter (where t.status = 'done') / count(t.id)) end as percent_done
from public.locations l
left join tree on tree.ancestor_id = l.id
left join public.tasks t on t.location_id = tree.location_id
group by l.id;

-- KPI: share of tasks closed with a photo by end of their scheduled day (Israel time). Target: 85%.
create view public.v_kpi_daily_closure with (security_invoker = true) as
select t.project_id, t.scheduled_date,
       count(*) as total_tasks,
       count(*) filter (
         where t.status = 'done'
           and (t.completed_at at time zone 'Asia/Jerusalem')::date <= t.scheduled_date
           and exists (select 1 from public.task_photos ph where ph.task_id = t.id)
       ) as closed_on_time_with_photo
from public.tasks t
group by t.project_id, t.scheduled_date;

-- Realtime for the live dashboard.
alter publication supabase_realtime add table public.attendance, public.tasks, public.task_photos;
