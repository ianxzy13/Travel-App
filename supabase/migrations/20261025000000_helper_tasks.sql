-- =============================================================
-- Vow – helpers can tick off their own to-dos
-- The "Helper" role promises "can edit tasks assigned to them", but the
-- database only let owners, editors and parents change to-dos.
-- Safe to run more than once.
-- =============================================================

drop policy if exists "tasks_update_assignee" on public.tasks;
create policy "tasks_update_assignee" on public.tasks for update to authenticated
  using (assignee_id = auth.uid() and public.is_wedding_member(wedding_id))
  with check (assignee_id = auth.uid() and public.is_wedding_member(wedding_id));
