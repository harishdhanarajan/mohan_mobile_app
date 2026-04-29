-- Drop the "blocked" status everywhere.
-- Existing tasks in 'blocked' fall back to 'todo' so they remain visible.
update public.tasks set status = 'todo' where status = 'blocked';

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('todo','in-progress','review','done'));
