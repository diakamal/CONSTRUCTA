-- Row Level Security. Rule of thumb:
--   managers/owners: full access inside their organization
--   workers: read what is assigned to them; all writes go through RPCs (see 0003_rpc.sql)

alter table public.organizations    enable row level security;
alter table public.teams            enable row level security;
alter table public.profiles         enable row level security;
alter table public.invitations      enable row level security;
alter table public.projects         enable row level security;
alter table public.project_members  enable row level security;
alter table public.locations        enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_photos      enable row level security;
alter table public.attendance       enable row level security;
alter table public.attendance_edits enable row level security;

-- organizations
create policy org_select on public.organizations for select using (id = public.current_org_id());
create policy org_update on public.organizations for update
  using (id = public.current_org_id() and public.is_manager());

-- teams
create policy teams_select on public.teams for select using (org_id = public.current_org_id());
create policy teams_write  on public.teams for all
  using (org_id = public.current_org_id() and public.is_manager())
  with check (org_id = public.current_org_id() and public.is_manager());

-- profiles: everyone sees themselves, managers see the whole org
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or (org_id = public.current_org_id() and public.is_manager()));
create policy profiles_manager_update on public.profiles for update
  using (org_id = public.current_org_id() and public.is_manager())
  with check (org_id = public.current_org_id());

-- invitations: managers only
create policy invitations_all on public.invitations for all
  using (org_id = public.current_org_id() and public.is_manager())
  with check (org_id = public.current_org_id() and public.is_manager());

-- projects: managers see all org projects, workers only projects they belong to
create policy projects_select on public.projects for select
  using (org_id = public.current_org_id() and (public.is_manager() or public.is_project_member(id)));
create policy projects_write on public.projects for all
  using (org_id = public.current_org_id() and public.is_manager())
  with check (org_id = public.current_org_id() and public.is_manager());

-- project_members
create policy members_select on public.project_members for select
  using (profile_id = auth.uid() or (public.project_org(project_id) = public.current_org_id() and public.is_manager()));
create policy members_write on public.project_members for all
  using (public.project_org(project_id) = public.current_org_id() and public.is_manager())
  with check (public.project_org(project_id) = public.current_org_id() and public.is_manager());

-- locations
create policy locations_select on public.locations for select
  using (public.project_org(project_id) = public.current_org_id()
         and (public.is_manager() or public.is_project_member(project_id)));
create policy locations_write on public.locations for all
  using (public.project_org(project_id) = public.current_org_id() and public.is_manager())
  with check (public.project_org(project_id) = public.current_org_id() and public.is_manager());

-- tasks: workers see tasks assigned to them or to their team, in projects they belong to
create policy tasks_select on public.tasks for select
  using (
    public.project_org(project_id) = public.current_org_id()
    and (
      public.is_manager()
      or (public.is_project_member(project_id)
          and (assignee_id = auth.uid()
               or team_id = (select team_id from public.profiles where id = auth.uid())))
    )
  );
create policy tasks_write on public.tasks for all
  using (public.project_org(project_id) = public.current_org_id() and public.is_manager())
  with check (public.project_org(project_id) = public.current_org_id() and public.is_manager());

-- task_photos: visible to managers of the org and to the uploader; rows are created by complete_task()
create policy photos_select on public.task_photos for select
  using (
    uploaded_by = auth.uid()
    or (public.is_manager() and exists (
          select 1 from public.tasks t
          where t.id = task_id and public.project_org(t.project_id) = public.current_org_id()))
  );

-- attendance: workers read their own shifts; writes only via check_in/check_out/edit_attendance
create policy attendance_select on public.attendance for select
  using (profile_id = auth.uid()
         or (public.is_manager() and public.project_org(project_id) = public.current_org_id()));

create policy attendance_edits_select on public.attendance_edits for select
  using (public.is_manager() and exists (
    select 1 from public.attendance a
    where a.id = attendance_id and public.project_org(a.project_id) = public.current_org_id()));

-- ---------- Storage: private bucket, path = {org_id}/{task_id}/{file}.jpg ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos'
              and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'task-photos'
         and (storage.foldername(name))[1] = public.current_org_id()::text
         and (owner = auth.uid() or public.is_manager()));
