-- Mirrors the production hardening migration applied to Supabase AGB.
-- Administrative event/message/activity access is performed by the trusted
-- Cloudflare API Worker using the server-side service role.

revoke all privileges on table public.activity_logs from anon, authenticated;
revoke all privileges on table public.events from anon, authenticated;
revoke all privileges on table public.messages from anon, authenticated;

revoke all privileges on table public.profiles from anon;
revoke insert, delete, truncate, references, trigger on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;

alter table public.activity_logs enable row level security;
alter table public.events enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;
