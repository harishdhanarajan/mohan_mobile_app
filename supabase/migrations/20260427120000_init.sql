-- MYT - schema only
-- Base schema that already exists in the linked Supabase project.
-- Keep this migration in the mobile repo so `supabase db push` matches remote history.

drop table if exists public.notifications cascade;
drop table if exists public.tasks cascade;
drop table if exists public.projects cascade;
drop table if exists public.users cascade;

create table public.users (
  id       text primary key,
  name     text not null,
  email    text not null unique,
  password text not null,
  role     text not null check (role in ('admin','user')),
  title    text
);

create table public.projects (
  id    text primary key,
  name  text not null,
  color text not null
);

create table public.tasks (
  id            text primary key,
  title         text not null,
  description   text default '',
  "assigneeId"  text references public.users(id)    on delete set null,
  "projectId"   text references public.projects(id) on delete set null,
  priority      text not null check (priority in ('high','medium','low')),
  status        text not null check (status in ('todo','in-progress','review','blocked','done')),
  "startDate"   date,
  "dueDate"     date,
  tags          jsonb not null default '[]'::jsonb,
  attachments   jsonb not null default '[]'::jsonb,
  comments      jsonb not null default '[]'::jsonb,
  activity      jsonb not null default '[]'::jsonb
);

create index tasks_assignee_idx on public.tasks ("assigneeId");
create index tasks_project_idx  on public.tasks ("projectId");
create index tasks_status_idx   on public.tasks (status);
create index tasks_due_idx      on public.tasks ("dueDate");

create table public.notifications (
  id        text primary key,
  ts        text not null,
  "actorId" text references public.users(id) on delete cascade,
  "taskId"  text references public.tasks(id) on delete cascade,
  kind      text not null,
  text      text not null,
  read      boolean not null default false
);

create index notifications_read_idx on public.notifications (read);

-- Phase 1: anon-key open access. Replace this with auth + RLS before production.
alter table public.users         disable row level security;
alter table public.projects      disable row level security;
alter table public.tasks         disable row level security;
alter table public.notifications disable row level security;

select
  (select count(*) from public.users)         as users,
  (select count(*) from public.projects)      as projects,
  (select count(*) from public.tasks)         as tasks,
  (select count(*) from public.notifications) as notifications;
