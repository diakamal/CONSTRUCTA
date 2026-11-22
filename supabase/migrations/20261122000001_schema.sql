-- CONSTRUCTA MVP schema: organizations, people, projects, locations, tasks, attendance.

create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type public.user_role      as enum ('owner', 'manager', 'worker');
create type public.app_language   as enum ('he', 'ar', 'th', 'en');
create type public.location_kind  as enum ('building', 'floor', 'unit', 'room');
create type public.task_status    as enum ('open', 'done');
create type public.project_status as enum ('active', 'archived');
create type public.attendance_source as enum ('app', 'manual');

-- ---------- Tables ----------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.teams (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  name               text not null,
  subcontractor_name text,
  created_at         timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  role       public.user_role not null default 'worker',
  full_name  text not null,
  phone      text,
  language   public.app_language not null default 'he',
  team_id    uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.profiles (org_id);

-- A manager pre-registers a worker by phone; the profile is created on first OTP sign-in.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  phone       text not null,               -- digits only, international format, e.g. 972501234567
  full_name   text not null,
  role        public.user_role not null default 'worker',
  language    public.app_language not null default 'he',
  team_id     uuid references public.teams(id) on delete set null,
  project_ids uuid[] not null default '{}',
  accepted_at timestamptz,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (org_id, phone)
);

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  address    text,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  radius_m   integer not null default 150 check (radius_m between 20 and 5000),
  status     public.project_status not null default 'active',
  created_at timestamptz not null default now()
);
create index on public.projects (org_id);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (project_id, profile_id)
);

create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id  uuid references public.locations(id) on delete cascade,
  kind       public.location_kind not null,
  name       text not null,
  sort       integer not null default 0
);
create index on public.locations (project_id);
create index on public.locations (parent_id);

create table public.tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  location_id    uuid references public.locations(id) on delete set null,
  title          text not null,
  instructions   text,
  video_url      text,
  assignee_id    uuid references public.profiles(id) on delete set null,
  team_id        uuid references public.teams(id) on delete set null,
  scheduled_date date not null default current_date,
  status         public.task_status not null default 'open',
  completed_at   timestamptz,
  completed_by   uuid references public.profiles(id),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  check (status = 'open' or completed_at is not null)
);
create index on public.tasks (project_id, scheduled_date);
create index on public.tasks (assignee_id, scheduled_date);
create index on public.tasks (team_id, scheduled_date);

create table public.task_photos (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null unique,
  taken_at     timestamptz not null default now(),
  uploaded_by  uuid not null references public.profiles(id)
);
create index on public.task_photos (task_id);

create table public.attendance (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  project_id         uuid not null references public.projects(id) on delete cascade,
  check_in_at        timestamptz not null default now(),
  check_in_lat       double precision,
  check_in_lng       double precision,
  check_in_accuracy  double precision,
  check_out_at       timestamptz,
  check_out_lat      double precision,
  check_out_lng      double precision,
  source             public.attendance_source not null default 'app',
  check (check_out_at is null or check_out_at > check_in_at)
);
create index on public.attendance (project_id, check_in_at);
-- At most one open shift per worker.
create unique index attendance_one_open_shift on public.attendance (profile_id) where check_out_at is null;

create table public.attendance_edits (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  old_check_in  timestamptz,
  old_check_out timestamptz,
  new_check_in  timestamptz,
  new_check_out timestamptz,
  reason        text not null check (length(trim(reason)) > 0),
  edited_by     uuid not null references public.profiles(id),
  edited_at     timestamptz not null default now()
);

-- ---------- Helpers (security definer so RLS policies can call them without recursion) ----------
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'manager'))
$$;

create or replace function public.project_org(p_project uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.projects where id = p_project
$$;

create or replace function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p_project and profile_id = auth.uid())
$$;

-- Great-circle distance in meters (mirrors packages/shared/src/geo.ts).
create or replace function public.distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.normalize_phone(p text) returns text
language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;
