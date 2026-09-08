import baseWorker from './audio-guestbook-api.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (
      request.method === 'GET' &&
      url.pathname === '/events'
    ) {
      const baseResponse = await baseWorker.fetch(request.clone(), env, ctx)

      if (!baseResponse.ok) {
        return baseResponse
      }

      const payload = await baseResponse.json()
      const lifecycleRows = await getLifecycleRows(env)
      const lifecycleMap = new Map(
        lifecycleRows.map((row) => [row.id, row])
      )

      await autoArchiveDueEvents(env, lifecycleRows)

      const refreshed = await getLifecycleRows(env)
      const refreshedMap = new Map(
        refreshed.map((row) => [row.id, row])
      )

      return json(
        {
          ...payload,
          events: (payload.events || []).map((event) => ({
            ...event,
            ...(refreshedMap.get(event.id) || lifecycleMap.get(event.id) || {}),
          })),
        },
        baseResponse.status,
        baseResponse.headers
      )
    }

    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/public/event/')
    ) {
      const baseResponse = await baseWorker.fetch(request.clone(), env, ctx)

      if (!baseResponse.ok) {
        return baseResponse
      }

      const event = await baseResponse.json()
      const lifecycle = await getLifecycleById(env, event.id)

      if (lifecycle) {
        await autoArchiveDueEvents(env, [lifecycle])
      }

      const refreshed = lifecycle
        ? await getLifecycleById(env, event.id)
        : null

      return json(
        {
          ...event,
          ...(refreshed || lifecycle || {}),
          auto_archive_at: calculateArchiveAt(
            event.event_date,
            (refreshed || lifecycle)?.auto_archive_enabled
          ),
        },
        baseResponse.status,
        baseResponse.headers
      )
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/event'
    ) {
      const baseResponse = await baseWorker.fetch(request.clone(), env, ctx)

      if (!baseResponse.ok) {
        return baseResponse
      }

      const payload = await baseResponse.json()
      const id = payload.event?.id

      if (id) {
        await patchEventLifecycle(env, id, {
          auto_archive_enabled: true,
        })

        const lifecycle = await getLifecycleById(env, id)

        payload.event = {
          ...payload.event,
          ...(lifecycle || {}),
          auto_archive_at: calculateArchiveAt(
            payload.event.event_date,
            lifecycle?.auto_archive_enabled
          ),
        }
      }

      return json(
        payload,
        baseResponse.status,
        baseResponse.headers
      )
    }

    const eventMatch = url.pathname.match(/^\/event\/([^/]+)$/)

    if (
      eventMatch &&
      request.method === 'PATCH'
    ) {
      const body = await request.clone().json().catch(() => ({}))
      const baseResponse = await baseWorker.fetch(request.clone(), env, ctx)

      if (!baseResponse.ok) {
        return baseResponse
      }

      const payload = await baseResponse.json()
      const id = decodeURIComponent(eventMatch[1])

      if ('auto_archive_enabled' in body) {
        await patchEventLifecycle(env, id, {
          auto_archive_enabled: Boolean(body.auto_archive_enabled),
        })
      }

      const lifecycle = await getLifecycleById(env, id)

      if (payload.event) {
        payload.event = {
          ...payload.event,
          ...(lifecycle || {}),
          auto_archive_at: calculateArchiveAt(
            payload.event.event_date,
            lifecycle?.auto_archive_enabled
          ),
        }
      }

      return json(
        payload,
        baseResponse.status,
        baseResponse.headers
      )
    }

    return baseWorker.fetch(request, env, ctx)
  },

  async scheduled(event, env, ctx) {
    if (baseWorker.scheduled) {
      await baseWorker.scheduled(event, env, ctx)
    }

    ctx.waitUntil(autoArchiveDueEvents(env))
  },
}

async function getLifecycleRows(env) {
  return sb(
    env,
    '/events?select=id,event_date,archived_at,auto_archive_enabled'
  )
}

async function getLifecycleById(env, id) {
  const rows = await sb(
    env,
    `/events?id=eq.${encodeURIComponent(id)}` +
      '&select=id,event_date,archived_at,auto_archive_enabled' +
      '&limit=1'
  )

  return rows[0] || null
}

async function patchEventLifecycle(env, id, values) {
  return sb(
    env,
    `/events?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: preferHeaders(env),
      body: JSON.stringify(values),
    }
  )
}

async function autoArchiveDueEvents(env, existingRows = null) {
  const rows = existingRows || await getLifecycleRows(env)
  const now = new Date()

  for (const row of rows) {
    if (
      !row.auto_archive_enabled ||
      row.archived_at ||
      !row.event_date
    ) {
      continue
    }

    const archiveAt = new Date(calculateArchiveAt(row.event_date, true))

    if (Number.isNaN(archiveAt.getTime()) || archiveAt > now) {
      continue
    }

    await patchEventLifecycle(env, row.id, {
      archived_at: now.toISOString(),
    })
  }
}

function calculateArchiveAt(eventDate, enabled) {
  if (!enabled || !eventDate) return null

  const parts = String(eventDate).split('-').map(Number)
  const [year, month, day] = parts

  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCMonth(date.getUTCMonth() + 3)

  return date.toISOString()
}

async function sb(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(text || `Supabase request failed: ${response.status}`)
  }

  return text ? JSON.parse(text) : []
}

function preferHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

function json(body, status = 200, sourceHeaders = undefined) {
  const headers = new Headers(sourceHeaders || {})
  headers.set('Content-Type', 'application/json; charset=utf-8')

  return new Response(JSON.stringify(body), {
    status,
    headers,
  })
}
