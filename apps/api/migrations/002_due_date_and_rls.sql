alter table tickets add column if not exists due_date_missing boolean default false;

create index if not exists idx_tickets_sla on tickets(current_status_sla);
create index if not exists idx_tickets_due_missing on tickets(due_date_missing);

alter table tickets enable row level security;
alter table status_history enable row level security;
alter table device_tokens enable row level security;

drop policy if exists "Authenticated read tickets" on tickets;
create policy "Authenticated read tickets" on tickets
  for select to authenticated using (true);

drop policy if exists "Authenticated read status_history" on status_history;
create policy "Authenticated read status_history" on status_history
  for select to authenticated using (true);

drop policy if exists "Users manage own device_tokens" on device_tokens;
create policy "Users manage own device_tokens" on device_tokens
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

grant select on tickets to authenticated;
grant select on status_history to authenticated;
grant all on device_tokens to authenticated;
