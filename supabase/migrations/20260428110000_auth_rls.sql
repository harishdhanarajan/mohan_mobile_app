-- Auth-backed workspace for the mobile app.
-- Apply this in the same Supabase project used by MYT.

alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade,
  add column if not exists active boolean not null default true;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.role = 'admin'
      and coalesce(u.active, true)
  );
$$;

create or replace function public.current_user_row_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and coalesce(u.active, true)
  limit 1;
$$;

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "users_select_own_or_admin" on public.users;
create policy "users_select_own_or_admin"
on public.users
for select
using (auth.uid() = auth_user_id or public.is_admin());

drop policy if exists "users_insert_self_or_admin" on public.users;
create policy "users_insert_self_or_admin"
on public.users
for insert
with check (auth.uid() = auth_user_id or public.is_admin());

drop policy if exists "users_update_self_or_admin" on public.users;
create policy "users_update_self_or_admin"
on public.users
for update
using (auth.uid() = auth_user_id or public.is_admin())
with check (auth.uid() = auth_user_id or public.is_admin());

drop policy if exists "users_delete_admin_only" on public.users;
create policy "users_delete_admin_only"
on public.users
for delete
using (public.is_admin());

drop policy if exists "projects_select_authenticated" on public.projects;
create policy "projects_select_authenticated"
on public.projects
for select
using (auth.uid() is not null);

drop policy if exists "projects_modify_admin_only" on public.projects;
create policy "projects_modify_admin_only"
on public.projects
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "tasks_select_admin_or_assignee" on public.tasks;
create policy "tasks_select_admin_or_assignee"
on public.tasks
for select
using (public.is_admin() or "assigneeId" = public.current_user_row_id());

drop policy if exists "tasks_insert_admin_or_assignee" on public.tasks;
create policy "tasks_insert_admin_or_assignee"
on public.tasks
for insert
with check (public.is_admin() or "assigneeId" = public.current_user_row_id());

drop policy if exists "tasks_update_admin_or_assignee" on public.tasks;
create policy "tasks_update_admin_or_assignee"
on public.tasks
for update
using (public.is_admin() or "assigneeId" = public.current_user_row_id())
with check (public.is_admin() or "assigneeId" = public.current_user_row_id());

drop policy if exists "tasks_delete_admin_only" on public.tasks;
create policy "tasks_delete_admin_only"
on public.tasks
for delete
using (public.is_admin());

drop policy if exists "notifications_select_admin_or_actor" on public.notifications;
create policy "notifications_select_admin_or_actor"
on public.notifications
for select
using (public.is_admin() or "actorId" = public.current_user_row_id());

drop policy if exists "notifications_insert_admin_or_actor" on public.notifications;
create policy "notifications_insert_admin_or_actor"
on public.notifications
for insert
with check (public.is_admin() or "actorId" = public.current_user_row_id());

drop policy if exists "notifications_update_admin_or_actor" on public.notifications;
create policy "notifications_update_admin_or_actor"
on public.notifications
for update
using (public.is_admin() or "actorId" = public.current_user_row_id())
with check (public.is_admin() or "actorId" = public.current_user_row_id());

