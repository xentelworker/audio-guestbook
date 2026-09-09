# Architecture

## Overview

Audio Guestbook separates the public/admin frontend, trusted API, database/authentication, and binary audio storage.

```text
Browser
  |
  +--> guestbook.snapapp.ca
  |      Cloudflare Worker: guestbook
  |      React/Vite static assets
  |
  +--> audio-guestbook-api.snapbooth.workers.dev
         Cloudflare Worker: audio-guestbook-api
            |
            +--> Supabase Auth/PostgreSQL
            |
            +--> Cloudflare R2: audio-guestbook
```

## Frontend

The React application handles the administrator UI and `/guestbook/{slug}` public client gallery.

The frontend Worker in `worker/frontend.js` serves static assets and injects Open Graph/Twitter metadata for gallery URLs.

Frontend production configuration is `wrangler.jsonc`.

## API

`worker/audio-guestbook-api.js` contains the primary API implementation.

`worker/audio-guestbook-api-lifecycle.js` wraps the base Worker and adds event lifecycle behavior, including auto archive, archived public-gallery enforcement, fresh archive cycles for overdue events, and no-store behavior for lifecycle-sensitive responses.

API production configuration is `wrangler.api.jsonc`.

## Data flow

Administrative requests use a Supabase user access token to authenticate to the API Worker. The Worker validates/authorizes the request and performs trusted database operations using its server-side service-role credential.

Public gallery routes expose only the event/message/audio data deliberately returned by public API endpoints.

Audio objects are stored in R2. Supabase stores metadata and the R2 object path rather than the audio bytes.

## Security boundary

The browser must never receive `SUPABASE_SERVICE_ROLE_KEY`.

RLS is enabled on all public-schema tables. Backend-managed tables (`events`, `messages`, `activity_logs`) have no direct anon/authenticated Data API privileges. `profiles` permits authenticated users to select/update only their own profile through RLS.

The API Worker is therefore the security boundary for administrative event/message operations.

## Event lifecycle

For a normal current/future event, Auto Archive targets three calendar months after the event date.

For an overdue historical event, manually enabling Auto Archive records `auto_archive_started_at` and begins a new three-month cycle from that timestamp.

Manual unarchive disables Auto Archive to prevent immediate re-archive. Re-enabling it can then establish a fresh cycle.

Archived events remain stored but public message/audio routes are closed.

## Deployment

Both frontend and API deployments are Git-connected to `main`.

A push can trigger both Cloudflare builds. Keep the two Wrangler configurations separate; the API deploy command must explicitly use `wrangler.api.jsonc`.
