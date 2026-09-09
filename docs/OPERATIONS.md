# Operations

## Production endpoints

- Frontend/admin/client gallery: `https://guestbook.snapapp.ca`
- Frontend workers.dev: `https://guestbook.snapbooth.workers.dev`
- API: `https://audio-guestbook-api.snapbooth.workers.dev`

## Git deployment

GitHub `main` is the source of truth. Cloudflare is connected directly to the repository.

Frontend:

```text
Build: npm run build
Deploy: npx wrangler deploy
Config: wrangler.jsonc
```

API:

```text
Build: npm run build
Deploy: npx wrangler deploy --config wrangler.api.jsonc
Config: wrangler.api.jsonc
```

Never deploy the API Worker using `wrangler.jsonc`; that file belongs to the frontend Worker.

## Production smoke test

After significant deployments:

1. Open the admin application.
2. Sign in.
3. Confirm Dashboard statistics/events load.
4. Open an event and confirm its messages load.
5. Open Client Gallery.
6. Play a compatible recording.
7. Test an individual download.
8. For lifecycle changes, test Archive -> closed gallery -> Unarchive -> restored gallery.

## Auto archive

New events default to Auto Archive on.

- Normal event: archive target = event date + 3 months.
- Historical overdue event when Auto Archive is newly enabled: archive target = enable time + 3 months.
- Manual unarchive: Auto Archive is disabled to keep the event restored.

A Cloudflare Cron trigger is required if exact unattended scheduled execution is desired. Lifecycle checks also occur during relevant API access.

## Trash

Message delete is a soft delete. Permanent delete is a separate API operation. Scheduled purge support exists in the Worker, but unattended cleanup requires the corresponding Cron trigger.

## Audio repair

Legacy files that have an `.mp3` extension but contain MPEG Layer II audio can fail browser playback.

Use `Repair Audio Guestbook.bat` / `tools/repair-audio.mjs` with an ordinary Supabase login. The workflow converts to true MP3, backs up the original R2 object, and preserves the message's identity/path relationship.

Repair backups are not automatically deleted and therefore increase R2 usage.

## Environment and secrets

Frontend public build variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_AUDIO_API_URL
```

API non-secret configuration includes `SUPABASE_URL`, `ADMIN_ORIGIN`, and the `AUDIO_BUCKET` R2 binding.

`SUPABASE_SERVICE_ROLE_KEY` is a Cloudflare Worker secret and must never be committed.

## Database changes

Track application schema migrations under `supabase/`. After a production migration, run Supabase Security Advisor and perform the production smoke test.
