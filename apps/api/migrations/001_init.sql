create extension if not exists pgcrypto;

create table if not exists tickets (
  ticket_key text primary key,
  summary text,
  assignee text,
  priority text,
  todo_start timestamptz,
  todo_end timestamptz,
  "todo_duration (min)" integer,
  todo_sla text,
  todo_sla_commented text,
  todo_sla_emailed text,
  inprogress_start timestamptz,
  inprogress_end timestamptz,
  "inprogress_duration (min)" integer,
  inprogress_sla text,
  inprogress_sla_commented text,
  inprogress_sla_emailed text,
  done_start timestamptz,
  "done_duration (min)" integer,
  current_status text,
  current_status_start timestamptz,
  current_status_duration integer,
  current_status_sla text,
  current_status_sla_threshold integer,
  status_team text,
  status_category text,
  created timestamptz,
  updated timestamptz,
  reporter text,
  issue_type text,
  project text,
  due_date text,
  due_date_missing boolean default false,
  description text,
  jira_ticket_url text,
  updated_at_db timestamptz default now()
);

create index if not exists idx_tickets_updated on tickets(updated);
create index if not exists idx_tickets_status on tickets(current_status);

create table if not exists status_history (
  history_id text primary key,
  timestamp timestamptz,
  ticket_key text references tickets(ticket_key) on delete cascade,
  old_status text,
  new_status text,
  updated_time timestamptz,
  assignee text,
  duration integer
);

create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  device_token text unique,
  platform text,
  created_at timestamptz default now()
);
