# Audio Guestbook

A production web application for managing and sharing pre-recorded audio guestbook messages for events.

## Production

- Admin/client application: `https://guestbook.snapapp.ca`
- Frontend Worker: `guestbook`
- API Worker: `audio-guestbook-api`
- Database/Auth: Supabase project `AGB`
- Audio storage: Cloudflare R2 bucket `audio-guestbook`
- Source of truth: this GitHub repository, branch `main`

Both Cloudflare Workers are connected to GitHub. Commits to `main` trigger Cloudflare builds/deployments. The frontend uses `wrangler.jsonc`; the API uses `wrangler.api.jsonc`. Do not deploy the API with the frontend Wrangler configuration.

## Stack

- React + Vite
- Cloudflare Workers + static assets
- Cloudflare R2
- Supabase Auth + PostgreSQL
- JSZip for browser ZIP exports

## Features

### Admin

- Supabase email/password authentication
- Dashboard with live statistics and newest-created recent events
- Create, edit, duplicate, archive, unarchive and delete events
- Search/filter events
- Bulk audio upload with progress
- Message visibility controls
- Rename/label messages
- Drag-and-drop ordering
- Bulk message actions
- CSV export and event backup/export
- Download All ZIP
- Trash, restore, permanent delete and scheduled trash purge support
- Storage/usage tools
- Activity log
- Audio repair workflow for legacy MP2 files mislabeled as MP3

### Client gallery

Public galleries use `/guestbook/{slug}` and support:

- Event information
- Message playback
- Continuous Play All
- Individual downloads
- Download All ZIP
- Event-cycle banner
- Closed archived-gallery screen
- Social sharing metadata

Archived galleries do not expose public message playback or downloads. Unarchiving restores access.

## Event lifecycle

New events default to automatic archiving.

Normal lifecycle:

`event date -> 3 months -> archive`

If Auto Archive is enabled on an older event whose original three-month deadline has already passed, the application starts a fresh three-month cycle from the time Auto Archive is enabled. This prevents an old imported event from immediately archiving.

Manual unarchive turns Auto Archive off so an overdue event is not immediately re-archived. The administrator can enable Auto Archive again to begin a fresh cycle.

Archiving does not delete recordings. It closes the public gallery while retaining the event and audio for the administrator.

## Database

Primary public-schema tables:

- `events`
- `messages`
- `profiles`
- `activity_logs`

Important lifecycle fields on `events` include `archived_at`, `auto_archive_enabled`, and `auto_archive_started_at`.

Message lifecycle/management fields include `custom_label`, `sort_order`, `deleted_at`, and `deleted_by`.

SQL migrations tracked in this repository are under [`supabase/`](supabase/).

## Security model

All exposed public-schema tables have Row Level Security enabled.

Direct Data API privileges are intentionally restricted:

| Table | Anonymous | Authenticated browser client |
| --- | --- | --- |
| `events` | none | none |
| `messages` | none | none |
| `activity_logs` | none | none |
| `profiles` | none | own profile SELECT/UPDATE only |

Administrative event/message/activity operations go through the trusted Cloudflare API Worker. The Worker uses the Supabase service-role credential server-side. **Never expose the service-role key in Vite/frontend environment variables, source code, commits, screenshots, or documentation.**

The Supabase Security Advisor may report an informational `RLS Enabled No Policy` notice for `activity_logs`. This is intentional: direct client access is denied and the trusted backend handles the table.

## Environment configuration

Frontend build variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_AUDIO_API_URL
```

API Worker configuration includes:

```text
SUPABASE_URL
ADMIN_ORIGIN
AUDIO_BUCKET       # R2 binding
```

The API also requires the Cloudflare secret:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Do not commit secret values. Production CORS currently allows the custom admin origin and the workers.dev frontend origin as configured in `wrangler.api.jsonc`/Cloudflare.

## Local development

Install dependencies and start Vite:

```bash
npm install
npm run dev
```

Create a local `.env.local` containing the public frontend variables. Never put the service-role key in `.env.local` used by Vite.

Build locally with:

```bash
npm run build
```

## Deployment

Normal deployment is Git-driven:

```text
change source
   -> commit/push main
   -> Cloudflare Git build
   -> production deployment
```

Frontend deployment uses:

```bash
npx wrangler deploy
```

API deployment uses:

```bash
npx wrangler deploy --config wrangler.api.jsonc
```

The API and frontend configurations are deliberately separate.

## Audio repair utility

Some historical `.mp3` uploads were actually MPEG Layer II (MP2), which many browsers cannot decode reliably. The repair utility converts affected recordings to true MP3 while preserving the message/event relationship and original R2 path.

Local repair files include:

```text
Repair Audio Guestbook.bat
tools/repair-audio.mjs
.env.repair              # local only; ignored by Git
```

The repair account uses an ordinary Supabase login. Do not place the service-role key in `.env.repair`.

The API repair endpoint creates an R2 backup before replacing the original object. Repair backups consume additional R2 storage and are not automatically deleted.

## Repository layout

```text
src/                         React application
public/                      Static assets
worker/frontend.js           Frontend Worker / social metadata
worker/audio-guestbook-api.js
worker/audio-guestbook-api-lifecycle.js
supabase/                    Tracked SQL migrations
tools/                       Maintenance utilities
wrangler.jsonc               Frontend Worker config
wrangler.api.jsonc           API Worker config
```

## Operational notes

- Soft-deleted messages remain in R2 until permanently deleted/purged.
- Browser ZIP generation can use significant memory for large events.
- Bulk operations are sequential and may partially complete if a request fails mid-operation.
- Event duplication copies event metadata, not audio recordings.
- Auto-archive checks run during relevant API access and can also run from the Worker's scheduled handler when a Cron trigger is configured.
- Exact scheduled trash cleanup/archiving requires the corresponding Cloudflare Cron trigger.

## Security checklist

Before production changes:

1. Keep `SUPABASE_SERVICE_ROLE_KEY` only in Cloudflare Worker secrets.
2. Never commit `.env`, `.env.local`, or `.env.repair`.
3. Keep RLS enabled on every exposed public-schema table.
4. Do not grant direct anonymous/authenticated access to `events`, `messages`, or `activity_logs` without deliberately redesigning the security model.
5. Run the Supabase Security Advisor after schema/permission changes.
6. Test admin login, event loading, a client gallery, playback and downloads after security or API changes.

## Current security status

As of September 8, 2026, the previous critical Supabase `rls_disabled_in_public` finding has been remediated. The database was hardened so backend-managed tables are not directly accessible to anonymous or normal authenticated Data API clients.

Supabase may still warn that leaked-password protection is disabled. Enabling that Auth feature is recommended as an additional account-security improvement.
