-- Allow any authenticated user to read all profile rows.
-- Needed so the mobile app can resolve names/avatars for admins and teammates
-- when rendering assignees, comment authors, and the team list.
-- Modifications (insert/update/delete) remain gated to self or admin.

drop policy if exists "users_select_own_or_admin" on public.users;
drop policy if exists "users_select_all_authenticated" on public.users;

create policy "users_select_all_authenticated"
on public.users
for select
using (auth.uid() is not null);
