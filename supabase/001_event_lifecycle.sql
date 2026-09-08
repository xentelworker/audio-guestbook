begin;

alter table public.events
  add column if not exists auto_archive_enabled boolean;

update public.events
set auto_archive_enabled = false
where auto_archive_enabled is null;

alter table public.events
  alter column auto_archive_enabled set default true;

alter table public.events
  alter column auto_archive_enabled set not null;

create index if not exists events_auto_archive_idx
  on public.events (auto_archive_enabled, archived_at, event_date);

commit;
