-- Let the current assignee reassign a task to an admin (review handoff)
-- without tripping the WITH CHECK clause on tasks UPDATE.
-- USING still gates who can initiate the update (admin or current assignee);
-- WITH CHECK now allows the new assignee to be either the same caller or any admin.

drop policy if exists "tasks_update_admin_or_assignee" on public.tasks;
create policy "tasks_update_admin_or_assignee"
on public.tasks
for update
using (public.is_admin() or "assigneeId" = public.current_user_row_id())
with check (
  public.is_admin()
  or "assigneeId" = public.current_user_row_id()
  or exists (
    select 1 from public.users
    where id = "assigneeId" and role = 'admin'
  )
);
