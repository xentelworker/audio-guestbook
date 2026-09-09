# Security

## Supabase

All exposed tables in the `public` schema use Row Level Security.

Current intended direct Data API access:

| Table | anon | authenticated |
| --- | --- | --- |
| `events` | none | none |
| `messages` | none | none |
| `activity_logs` | none | none |
| `profiles` | none | SELECT/UPDATE own row only |

The application intentionally performs administrative event/message/activity operations through the Cloudflare API Worker with the server-side Supabase service role.

`activity_logs` intentionally has no client RLS policy. Supabase can therefore report the informational `RLS Enabled No Policy` advisory. Do not add a broad client policy merely to silence that advisory.

## Secrets

Never commit or expose:

- `SUPABASE_SERVICE_ROLE_KEY`
- user passwords
- repair-tool credentials
- Cloudflare/API tokens

The service-role key belongs only in the API Worker's Cloudflare secret configuration.

Frontend variables beginning with `VITE_` are compiled into browser-accessible JavaScript and must be treated as public. The Supabase anon key is appropriate there; the service-role key is not.

## R2

Audio is served through Worker routes rather than exposing administrative R2 credentials to the browser.

Archived public galleries must not serve their messages or audio. The lifecycle Worker returns an archived response and uses `Cache-Control: no-store` for lifecycle-sensitive responses to avoid stale archive/unarchive state.

## Authentication

Admin authentication uses Supabase Auth. Supabase leaked-password protection is recommended when available/configured for the project.

## Security checks

After database DDL, grants, RLS or policy changes:

1. Run Supabase Security Advisor.
2. Confirm no unexpected critical `rls_disabled_in_public` findings.
3. Verify anon/authenticated grants remain restricted.
4. Test admin authentication and API operations.
5. Test a public active gallery.
6. Test an archived gallery and verify playback/downloads are blocked.

## September 2026 hardening

The project previously received a Supabase warning that a public table had RLS disabled. RLS was enabled on `activity_logs`, followed by a broader permission audit.

The production database was subsequently hardened so `events`, `messages`, and `activity_logs` cannot be directly selected/inserted/updated/deleted by anon or normal authenticated Data API roles. `profiles` is limited to authenticated self-service SELECT/UPDATE.

This matches the application's API-first security architecture.
