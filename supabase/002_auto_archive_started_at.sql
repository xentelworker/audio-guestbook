alter table public.events
  add column if not exists auto_archive_started_at timestamptz;

create index if not exists events_auto_archive_started_at_idx
  on public.events (auto_archive_started_at);
