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

      await autoArchiveDueEvents(env, lifecycleRows)

      const refreshed = await getLifecycleRows(env)
      const lifecycleMap = new Map(
        refreshed.map((row) => [row.id, row])
      )

      const mergedEvents = (payload.events || [])
        .map((event) => ({
          ...event,
          ...(lifecycleMap.get(event.id) || {}),
        }))
        .sort((a, b) => {
          const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
          const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
          return bCreated - aCreated
        })

      return json(
        {
          ...payload,
          events: mergedEvents,
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

    const publicMessagesMatch = url.pathname.match(/^\/public\/messages\/([^/]+)$/)

    if (
      publicMessagesMatch &&
      request.method === 'GET'
    ) {
      const slug = decodeURIComponent(publicMessagesMatch[1])
      const lifecycle = await getLifecycleBySlug(env, slug)

      if (lifecycle) {
        await autoArchiveDueEvents(env, [lifecycle])
        const refreshed = await getLifecycleById(env, lifecycle.id)

        if (refreshed?.archived_at) {
          return publicJson(
            {
              error: 'This audio guestbook has been archived.',
              archived: true,
              archived_at: refreshed.archived_at,
            },
            410,
            request,
            env
          )
        }
      }

      const response = await baseWorker.fetch(request, env, ctx)
      return withNoStore(response)
    }

    const publicAudioMatch = url.pathname.match(/^\/public\/audio\/([^/]+)$/)

    if (
      publicAudioMatch &&
      request.method === 'GET'
    ) {
      const messageId = decodeURIComponent(publicAudioMatch[1])
      const lifecycle = await getLifecycleForMessage(env, messageId)

      if (lifecycle) {
        await autoArchiveDueEvents(env, [lifecycle])
        const refreshed = await getLifecycleById(env, lifecycle.id)

        if (refreshed?.archived_at) {
          return publicJson(
            {
              error: 'This audio guestbook has been archived.',
              archived: true,
              archived_at: refreshed.archived_at,
            },
            410,
            request,
            env
          )
        }
      }

      return baseWorker.fetch(request, env, ctx)
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
      const id = decodeURIComponent(eventMatch[1])
      const baseFields = [
        'name',
        'event_date',
        'description',
        'archived_at',
      ]
      const hasBaseChanges = baseFields.some((key) => key in body)

      let payload
      let sourceResponse

      if (hasBaseChanges) {
        sourceResponse = await baseWorker.fetch(request.clone(), env, ctx)

        if (!sourceResponse.ok) {
          return sourceResponse
        }

        payload = await sourceResponse.json()
      } else {
        const authUrl = new URL('/events', request.url)
        const authRequest = new Request(authUrl.toString(), {
          method: 'GET',
          headers: request.headers,
        })

        sourceResponse = await baseWorker.fetch(authRequest, env, ctx)

        if (!sourceResponse.ok) {
          return sourceResponse
        }

        const authPayload = await sourceResponse.json()
        const existing = (authPayload.events || []).find((event) => event.id === id)

        if (!existing) {
          return json(
            { error: 'Event not found' },
            404,
            sourceResponse.headers
          )
        }

        payload = {
          success: true,
          event: existing,
        }
      }

      if ('auto_archive_enabled' in body) {
        await patchEventLifecycle(env, id, {
          auto_archive_enabled: Boolean(body.auto_archive_enabled),
        })
      } else if ('archived_at' in body && !body.archived_at) {
        // Manual unarchive should restore access instead of immediately
        // auto-archiving an event whose archive date is already in the past.
        await patchEventLifecycle(env, id, {
          auto_archive_enabled: false,
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
        200,
        sourceResponse.headers
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
    '/events?select=id,event_date,created_at,archived_at,auto_archive_enabled'
  )
}

async function getLifecycleById(env, id) {
  const rows = await sb(
    env,
    `/events?id=eq.${encodeURIComponent(id)}` +
      '&select=id,event_date,created_at,archived_at,auto_archive_enabled' +
      '&limit=1'
  )

  return rows[0] || null
}

async function getLifecycleBySlug(env, slug) {
  const rows = await sb(
    env,
    `/events?slug=eq.${encodeURIComponent(slug)}` +
      '&select=id,event_date,created_at,archived_at,auto_archive_enabled' +
      '&limit=1'
  )

  return rows[0] || null
}

async function getLifecycleForMessage(env, messageId) {
  const messages = await sb(
    env,
    `/messages?id=eq.${encodeURIComponent(messageId)}` +
      '&select=event_id&limit=1'
  )

  const eventId = messages[0]?.event_id
  if (!eventId) return null

  return getLifecycleById(env, eventId)
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

    const archiveAtValue = calculateArchiveAt(row.event_date, true)
    if (!archiveAtValue) continue

    const archiveAt = new Date(archiveAtValue)

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

function publicCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const allowed = String(env.ADMIN_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (origin && allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    }
  }

  return {
    'Access-Control-Allow-Origin': allowed[0] || '*',
    Vary: 'Origin',
  }
}

function publicJson(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...publicCorsHeaders(request, env),
    },
  })
}

function withNoStore(response) {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function json(body, status = 200, sourceHeaders = undefined) {
  const headers = new Headers(sourceHeaders || {})
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')

  return new Response(JSON.stringify(body), {
    status,
    headers,
  })
}
