export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const corsHeaders = corsFor(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/health'
    ) {
      return json(
        {
          ok: true,
          service: 'audio-guestbook-api',
          r2: Boolean(env.AUDIO_BUCKET),
          supabase: Boolean(env.SUPABASE_URL),
        },
        200,
        corsHeaders
      )
    }

    try {
      // ======================================================
      // PUBLIC EVENT
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname.startsWith('/public/event/')
      ) {
        const slug = decodeURIComponent(
          url.pathname.slice('/public/event/'.length)
        )

        const rows = await sb(
          env,
          `/events?slug=eq.${enc(slug)}` +
            `&select=id,name,slug,event_date,description` +
            `&limit=1`
        )

        if (!rows.length) {
          return json(
            { error: 'Event not found' },
            404,
            corsHeaders
          )
        }

        return json(rows[0], 200, corsHeaders)
      }

      // ======================================================
      // PUBLIC MESSAGES
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname.startsWith('/public/messages/')
      ) {
        const slug = decodeURIComponent(
          url.pathname.slice('/public/messages/'.length)
        )

        const events = await sb(
          env,
          `/events?slug=eq.${enc(slug)}&select=id&limit=1`
        )

        if (!events.length) {
          return json(
            { error: 'Event not found' },
            404,
            corsHeaders
          )
        }

        const rows = await sb(
          env,
          `/messages?event_id=eq.${enc(events[0].id)}` +
            `&deleted_at=is.null` +
            `&is_visible=eq.true` +
            `&select=id,message_number,file_name,duration,file_size,created_at,is_visible,custom_label,sort_order` +
            `&order=sort_order.asc.nullslast,message_number.asc`
        )

        return json(rows, 200, corsHeaders)
      }

      // ======================================================
      // PUBLIC AUDIO
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname.startsWith('/public/audio/')
      ) {
        const id = decodeURIComponent(
          url.pathname.slice('/public/audio/'.length)
        )

        const rows = await sb(
          env,
          `/messages?id=eq.${enc(id)}` +
            `&deleted_at=is.null` +
            `&is_visible=eq.true` +
            `&select=id,file_path,file_name` +
            `&limit=1`
        )

        if (!rows.length) {
          return json(
            { error: 'Recording not found' },
            404,
            corsHeaders
          )
        }

        return streamR2Audio(
          request,
          env,
          rows[0],
          corsHeaders,
          url.searchParams.get('download') === '1'
        )
      }

      // ======================================================
      // ADMIN AUTH
      // ======================================================

      const auth = await verifySupabaseUser(
        request,
        env
      )

      if (!auth.ok) {
        return json(
          { error: auth.error },
          401,
          corsHeaders
        )
      }

      const userId = auth.user?.id || null

      // ======================================================
      // GET EVENTS
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname === '/events'
      ) {
        const rows = await sb(
          env,
          '/events?' +
            'select=id,name,slug,event_date,description,archived_at' +
            '&order=event_date.desc.nullslast,name.asc'
        )

        return json(
          { events: rows },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // CREATE EVENT
      // ======================================================

      if (
        request.method === 'POST' &&
        url.pathname === '/event'
      ) {
        const body = await safeBody(request)

        const name = String(
          body.name || ''
        ).trim()

        if (!name) {
          return json(
            { error: 'Event name is required' },
            400,
            corsHeaders
          )
        }

        const slug = await uniqueSlug(
          env,
          slugify(name)
        )

        const rows = await sb(
          env,
          '/events',
          {
            method: 'POST',
            headers: preferHeaders(env),
            body: JSON.stringify({
              name,
              slug,
              event_date:
                body.event_date || null,
              description:
                String(
                  body.description || ''
                ).trim() || null,
            }),
          }
        )

        await logActivity(
          env,
          userId,
          'event_created',
          'event',
          rows[0]?.id,
          { name }
        )

        return json(
          {
            success: true,
            event: rows[0],
          },
          201,
          corsHeaders
        )
      }

      // ======================================================
      // EVENT ROUTES
      // ======================================================

      const eventMatch =
        url.pathname.match(
          /^\/event\/([^/]+)$/
        )

      // ------------------------------------------------------
      // UPDATE EVENT
      // ------------------------------------------------------

      if (
        eventMatch &&
        request.method === 'PATCH'
      ) {
        const id = decodeURIComponent(
          eventMatch[1]
        )

        const body =
          await safeBody(request)

        const allowed = {}

        if ('name' in body) {
          const name = String(
            body.name || ''
          ).trim()

          if (!name) {
            return json(
              {
                error:
                  'Event name is required',
              },
              400,
              corsHeaders
            )
          }

          allowed.name = name
        }

        if ('event_date' in body) {
          allowed.event_date =
            body.event_date || null
        }

        if ('description' in body) {
          allowed.description =
            String(
              body.description || ''
            ).trim() || null
        }

        if ('archived_at' in body) {
          allowed.archived_at =
            body.archived_at || null
        }

        const rows = await sb(
          env,
          `/events?id=eq.${enc(id)}`,
          {
            method: 'PATCH',
            headers:
              preferHeaders(env),
            body:
              JSON.stringify(allowed),
          }
        )

        if (!rows.length) {
          return json(
            { error: 'Event not found' },
            404,
            corsHeaders
          )
        }

        await logActivity(
          env,
          userId,
          'event_updated',
          'event',
          id,
          {
            name: rows[0].name,
            changes:
              Object.keys(allowed),
          }
        )

        return json(
          {
            success: true,
            event: rows[0],
          },
          200,
          corsHeaders
        )
      }

      // ------------------------------------------------------
      // DUPLICATE EVENT
      // ------------------------------------------------------

      const duplicateMatch =
        url.pathname.match(
          /^\/event\/([^/]+)\/duplicate$/
        )

      if (
        duplicateMatch &&
        request.method === 'POST'
      ) {
        const sourceId =
          decodeURIComponent(
            duplicateMatch[1]
          )

        const body =
          await safeBody(request)

        const source = (
          await sb(
            env,
            `/events?id=eq.${enc(sourceId)}` +
              `&select=id,name,event_date,description` +
              `&limit=1`
          )
        )[0]

        if (!source) {
          return json(
            { error: 'Event not found' },
            404,
            corsHeaders
          )
        }

        const name = String(
          body.name ||
            `${source.name} Copy`
        ).trim()

        const slug =
          await uniqueSlug(
            env,
            slugify(name)
          )

        const rows = await sb(
          env,
          '/events',
          {
            method: 'POST',
            headers:
              preferHeaders(env),
            body: JSON.stringify({
              name,
              slug,
              event_date:
                source.event_date,
              description:
                source.description,
              archived_at: null,
            }),
          }
        )

        await logActivity(
          env,
          userId,
          'event_duplicated',
          'event',
          rows[0]?.id,
          {
            name,
            source_event_id:
              sourceId,
          }
        )

        return json(
          {
            success: true,
            event: rows[0],
          },
          201,
          corsHeaders
        )
      }

      // ------------------------------------------------------
      // DELETE EVENT
      // ------------------------------------------------------

      if (
        eventMatch &&
        request.method === 'DELETE'
      ) {
        const id =
          decodeURIComponent(
            eventMatch[1]
          )

        const event = (
          await sb(
            env,
            `/events?id=eq.${enc(id)}` +
              `&select=id,name` +
              `&limit=1`
          )
        )[0]

        if (!event) {
          return json(
            { error: 'Event not found' },
            404,
            corsHeaders
          )
        }

        const messages =
          await sb(
            env,
            `/messages?event_id=eq.${enc(id)}` +
              `&select=id,file_path`
          )

        for (
          const message of messages
        ) {
          if (message.file_path) {
            await env.AUDIO_BUCKET.delete(
              message.file_path
            )
          }
        }

        await sb(
          env,
          `/messages?event_id=eq.${enc(id)}`,
          {
            method: 'DELETE',
            headers:
              minHeaders(env),
          }
        )

        await sb(
          env,
          `/events?id=eq.${enc(id)}`,
          {
            method: 'DELETE',
            headers:
              minHeaders(env),
          }
        )

        await logActivity(
          env,
          userId,
          'event_deleted',
          'event',
          id,
          {
            name: event.name,
            recordings:
              messages.length,
          }
        )

        return json(
          {
            success: true,
            id,
            deleted_messages:
              messages.length,
          },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // GET EVENT MESSAGES
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname.startsWith(
          '/messages/'
        )
      ) {
        const eventId =
          decodeURIComponent(
            url.pathname.slice(
              '/messages/'.length
            )
          )

        const rows = await sb(
          env,
          `/messages?event_id=eq.${enc(eventId)}` +
            `&deleted_at=is.null` +
            `&select=id,event_id,message_number,file_path,file_name,duration,file_size,created_at,is_visible,custom_label,sort_order,deleted_at` +
            `&order=sort_order.asc.nullslast,message_number.asc`
        )

        return json(
          { messages: rows },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // UPLOAD AUDIO
      // ======================================================

      if (
        request.method === 'POST' &&
        url.pathname.startsWith(
          '/upload/'
        )
      ) {
        const eventId =
          decodeURIComponent(
            url.pathname.slice(
              '/upload/'.length
            )
          )

        console.log(
          'UPLOAD START',
          eventId
        )

        const event = (
          await sb(
            env,
            `/events?id=eq.${enc(eventId)}` +
              `&select=id,name,slug` +
              `&limit=1`
          )
        )[0]

        if (!event) {
          return json(
            { error: 'Event not found' },
            404,
            corsHeaders
          )
        }

        let fileName =
          request.headers.get(
            'X-File-Name'
          ) || 'recording'

        try {
          fileName =
            decodeURIComponent(
              fileName
            )
        } catch {
          // Keep original file name.
        }

        const fileSize = Number(
          request.headers.get(
            'X-File-Size'
          ) || 0
        )

        const duration = Number(
          request.headers.get(
            'X-Duration'
          ) || 0
        )

        const contentType =
          request.headers.get(
            'Content-Type'
          ) ||
          'application/octet-stream'

        console.log(
          'UPLOAD FILE',
          fileName,
          fileSize,
          duration,
          contentType
        )

        // ----------------------------------------------------
        // GET NEXT MESSAGE NUMBER
        // ----------------------------------------------------

        const existing =
          await sb(
            env,
            `/messages?event_id=eq.${enc(eventId)}` +
              `&select=message_number,sort_order` +
              `&order=message_number.desc` +
              `&limit=1`
          )

        const nextNumber =
          existing.length
            ? Number(
                existing[0]
                  .message_number
              ) + 1
            : 1

        const previousSort =
          existing.length
            ? Number(
                existing[0]
                  .sort_order || 0
              )
            : 0

        const sortOrder =
          Math.max(
            previousSort + 1,
            nextNumber
          )

        const key =
          `events/${event.slug}/` +
          `${String(
            nextNumber
          ).padStart(4, '0')}-` +
          `${crypto.randomUUID()}-` +
          `${safeObjectName(fileName)}`

        console.log(
          'UPLOAD R2 KEY',
          key
        )

        // ----------------------------------------------------
        // SAVE FILE TO R2
        // ----------------------------------------------------

        try {
          await env.AUDIO_BUCKET.put(
            key,
            request.body,
            {
              httpMetadata: {
                contentType,
              },
            }
          )
        } catch (error) {
          console.error(
            'R2 UPLOAD FAILED:',
            error?.message || error,
            error?.stack || ''
          )

          throw new Error(
            `R2 upload failed: ${
              error?.message ||
              'Unknown R2 error'
            }`
          )
        }

        console.log(
          'UPLOAD R2 COMPLETE',
          key
        )

        // ----------------------------------------------------
        // SAVE MESSAGE TO SUPABASE
        // ----------------------------------------------------

        let rows

        try {
          rows = await sb(
            env,
            '/messages',
            {
              method: 'POST',
              headers:
                preferHeaders(env),
              body: JSON.stringify({
                event_id: eventId,
                message_number:
                  nextNumber,
                file_path: key,
                file_name: fileName,
                duration:
                  duration > 0
                    ? Math.round(
                        duration
                      )
                    : null,
                file_size:
                  fileSize > 0
                    ? fileSize
                    : null,
                is_visible: true,
                sort_order:
                  sortOrder,
              }),
            }
          )
        } catch (error) {
          console.error(
            'MESSAGE INSERT FAILED:',
            error?.message || error
          )

          try {
            await env.AUDIO_BUCKET.delete(
              key
            )
          } catch (
            rollbackError
          ) {
            console.error(
              'R2 ROLLBACK FAILED:',
              rollbackError?.message ||
                rollbackError
            )
          }

          throw error
        }

        console.log(
          'UPLOAD DATABASE COMPLETE',
          rows[0]?.id
        )

        await logActivity(
          env,
          userId,
          'message_uploaded',
          'message',
          rows[0]?.id,
          {
            event_id: eventId,
            file_name: fileName,
          }
        )

        return json(
          {
            success: true,
            message: rows[0],
          },
          201,
          corsHeaders
        )
      }

      // ======================================================
      // ADMIN AUDIO
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname.startsWith(
          '/audio/'
        )
      ) {
        const id =
          decodeURIComponent(
            url.pathname.slice(
              '/audio/'.length
            )
          )

        const rows = await sb(
          env,
          `/messages?id=eq.${enc(id)}` +
            `&deleted_at=is.null` +
            `&select=id,file_path,file_name` +
            `&limit=1`
        )

        if (!rows.length) {
          return json(
            {
              error:
                'Recording not found',
            },
            404,
            corsHeaders
          )
        }

        return streamR2Audio(
          request,
          env,
          rows[0],
          corsHeaders,
          url.searchParams.get(
            'download'
          ) === '1'
        )
      }

      // ======================================================
      // SHOW / HIDE
      // ======================================================

      if (
        request.method === 'POST' &&
        url.pathname.startsWith(
          '/visibility/'
        )
      ) {
        const id =
          decodeURIComponent(
            url.pathname.slice(
              '/visibility/'.length
            )
          )

        const body =
          await safeBody(request)

        if (
          typeof body.is_visible !==
          'boolean'
        ) {
          return json(
            {
              error:
                'is_visible must be true or false',
            },
            400,
            corsHeaders
          )
        }

        const rows = await sb(
          env,
          `/messages?id=eq.${enc(id)}` +
            `&deleted_at=is.null`,
          {
            method: 'PATCH',
            headers:
              preferHeaders(env),
            body: JSON.stringify({
              is_visible:
                body.is_visible,
            }),
          }
        )

        if (!rows.length) {
          return json(
            { error: 'Message not found' },
            404,
            corsHeaders
          )
        }

        await logActivity(
          env,
          userId,
          body.is_visible
            ? 'message_shown'
            : 'message_hidden',
          'message',
          id,
          {}
        )

        return json(
          {
            success: true,
            message: rows[0],
          },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // MESSAGE ROUTES
      // ======================================================

      const messageMatch =
        url.pathname.match(
          /^\/message\/([^/]+)$/
        )

      // ------------------------------------------------------
      // UPDATE MESSAGE
      // ------------------------------------------------------

      if (
        messageMatch &&
        request.method === 'PATCH'
      ) {
        const id =
          decodeURIComponent(
            messageMatch[1]
          )

        const body =
          await safeBody(request)

        const allowed = {}

        if (
          'custom_label' in body
        ) {
          allowed.custom_label =
            String(
              body.custom_label || ''
            ).trim() || null
        }

        if (
          'sort_order' in body
        ) {
          allowed.sort_order =
            Number(
              body.sort_order
            )
        }

        if (
          !Object.keys(
            allowed
          ).length
        ) {
          return json(
            {
              error:
                'No supported fields supplied',
            },
            400,
            corsHeaders
          )
        }

        const rows = await sb(
          env,
          `/messages?id=eq.${enc(id)}` +
            `&deleted_at=is.null`,
          {
            method: 'PATCH',
            headers:
              preferHeaders(env),
            body:
              JSON.stringify(allowed),
          }
        )

        if (!rows.length) {
          return json(
            { error: 'Message not found' },
            404,
            corsHeaders
          )
        }

        await logActivity(
          env,
          userId,
          'message_updated',
          'message',
          id,
          {
            changes:
              Object.keys(allowed),
          }
        )

        return json(
          {
            success: true,
            message: rows[0],
          },
          200,
          corsHeaders
        )
      }

      // ------------------------------------------------------
      // SOFT DELETE / TRASH
      // ------------------------------------------------------

      if (
        messageMatch &&
        request.method === 'DELETE'
      ) {
        const id =
          decodeURIComponent(
            messageMatch[1]
          )

        const rows = await sb(
          env,
          `/messages?id=eq.${enc(id)}` +
            `&deleted_at=is.null`,
          {
            method: 'PATCH',
            headers:
              preferHeaders(env),
            body: JSON.stringify({
              deleted_at:
                new Date().toISOString(),
              deleted_by:
                userId,
              is_visible:
                false,
            }),
          }
        )

        if (!rows.length) {
          return json(
            { error: 'Message not found' },
            404,
            corsHeaders
          )
        }

        await logActivity(
          env,
          userId,
          'message_trashed',
          'message',
          id,
          {
            event_id:
              rows[0].event_id,
          }
        )

        return json(
          {
            success: true,
            message: rows[0],
          },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // TRASH
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname === '/trash'
      ) {
        const rows = await sb(
          env,
          `/messages?deleted_at=not.is.null` +
            `&select=id,event_id,message_number,file_path,file_name,duration,file_size,created_at,is_visible,custom_label,sort_order,deleted_at` +
            `&order=deleted_at.desc`
        )

        const eventRows =
          await sb(
            env,
            '/events?select=id,name'
          )

        const names =
          Object.fromEntries(
            eventRows.map(
              (event) => [
                event.id,
                event.name,
              ]
            )
          )

        return json(
          {
            messages: rows.map(
              (message) => ({
                ...message,
                event_name:
                  names[
                    message.event_id
                  ] ||
                  'Deleted event',
              })
            ),
          },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // RESTORE MESSAGE
      // ======================================================

      const restoreMatch =
        url.pathname.match(
          /^\/message\/([^/]+)\/restore$/
        )

      if (
        restoreMatch &&
        request.method === 'POST'
      ) {
        const id =
          decodeURIComponent(
            restoreMatch[1]
          )

        const rows = await sb(
          env,
          `/messages?id=eq.${enc(id)}` +
            `&deleted_at=not.is.null`,
          {
            method: 'PATCH',
            headers:
              preferHeaders(env),
            body: JSON.stringify({
              deleted_at: null,
              deleted_by: null,
            }),
          }
        )

        if (!rows.length) {
          return json(
            {
              error:
                'Message not found in Trash',
            },
            404,
            corsHeaders
          )
        }

        await logActivity(
          env,
          userId,
          'message_restored',
          'message',
          id,
          {
            event_id:
              rows[0].event_id,
          }
        )

        return json(
          {
            success: true,
            message: rows[0],
          },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // PERMANENT DELETE
      // ======================================================

      const permanentMatch =
        url.pathname.match(
          /^\/message\/([^/]+)\/permanent$/
        )

      if (
        permanentMatch &&
        request.method === 'DELETE'
      ) {
        const id =
          decodeURIComponent(
            permanentMatch[1]
          )

        const message = (
          await sb(
            env,
            `/messages?id=eq.${enc(id)}` +
              `&select=id,file_path,event_id` +
              `&limit=1`
          )
        )[0]

        if (!message) {
          return json(
            { error: 'Message not found' },
            404,
            corsHeaders
          )
        }

        if (
          message.file_path
        ) {
          await env.AUDIO_BUCKET.delete(
            message.file_path
          )
        }

        await sb(
          env,
          `/messages?id=eq.${enc(id)}`,
          {
            method: 'DELETE',
            headers:
              minHeaders(env),
          }
        )

        await logActivity(
          env,
          userId,
          'message_permanently_deleted',
          'message',
          id,
          {
            event_id:
              message.event_id,
          }
        )

        return json(
          {
            success: true,
            id,
          },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // PURGE TRASH
      // ======================================================

      if (
        request.method === 'POST' &&
        url.pathname ===
          '/purge-trash'
      ) {
        const body =
          await safeBody(request)

        const cutoff =
          body.all
            ? null
            : new Date(
                Date.now() -
                  30 *
                    24 *
                    60 *
                    60 *
                    1000
              ).toISOString()

        const query =
          cutoff
            ? `/messages?deleted_at=lt.${enc(cutoff)}` +
              `&select=id,file_path,event_id`
            : `/messages?deleted_at=not.is.null` +
              `&select=id,file_path,event_id`

        const rows =
          await sb(
            env,
            query
          )

        for (
          const message of rows
        ) {
          if (
            message.file_path
          ) {
            await env.AUDIO_BUCKET.delete(
              message.file_path
            )
          }
        }

        if (rows.length) {
          if (cutoff) {
            await sb(
              env,
              `/messages?deleted_at=lt.${enc(cutoff)}`,
              {
                method:
                  'DELETE',
                headers:
                  minHeaders(env),
              }
            )
          } else {
            await sb(
              env,
              '/messages?deleted_at=not.is.null',
              {
                method:
                  'DELETE',
                headers:
                  minHeaders(env),
              }
            )
          }
        }

        await logActivity(
          env,
          userId,
          'trash_purged',
          'system',
          null,
          {
            count: rows.length,
            all: Boolean(
              body.all
            ),
          }
        )

        return json(
          {
            success: true,
            deleted:
              rows.length,
          },
          200,
          corsHeaders
        )
      }

      // ======================================================
      // ACTIVITY LOG
      // ======================================================

      if (
        request.method === 'GET' &&
        url.pathname === '/activity'
      ) {
        const limit =
          Math.min(
            500,
            Math.max(
              1,
              Number(
                url.searchParams.get(
                  'limit'
                ) || 100
              )
            )
          )

        const rows = await sb(
          env,
          `/activity_logs?` +
            `select=id,user_id,action,entity_type,entity_id,details,created_at` +
            `&order=created_at.desc` +
            `&limit=${limit}`
        )

        return json(
          {
            activity: rows,
          },
          200,
          corsHeaders
        )
      }

      return json(
        {
          error: 'Not found',
        },
        404,
        corsHeaders
      )
    } catch (error) {
      console.error(
        'Worker error:',
        error?.message ||
          error,
        error?.stack || ''
      )

      return json(
        {
          error:
            'Internal server error',
          message:
            error?.message ||
            'Unknown error',
        },
        500,
        corsHeaders
      )
    }
  },

  // ==========================================================
  // SCHEDULED TRASH CLEANUP
  // ==========================================================

  async scheduled(
    _event,
    env,
    ctx
  ) {
    ctx.waitUntil(
      purgeExpiredTrash(env)
    )
  },
}

// ============================================================
// CORS
// ============================================================

function corsFor(
  request,
  env
) {
  const origin =
    request.headers.get(
      'Origin'
    ) || ''

  const adminOrigins =
    String(
      env.ADMIN_ORIGIN || ''
    )
      .split(',')
      .map((value) =>
        value.trim()
      )
      .filter(Boolean)

  const allowed = [
    ...adminOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]

  const allowedOrigin =
    allowed.includes(origin)
      ? origin
      : adminOrigins[0] ||
        origin ||
        '*'

  return {
    'Access-Control-Allow-Origin':
      allowedOrigin,

    'Access-Control-Allow-Methods':
      'GET, POST, PATCH, DELETE, OPTIONS',

    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, X-File-Name, X-File-Size, X-Duration',

    'Access-Control-Expose-Headers':
      'Content-Length, Content-Range, Accept-Ranges, Content-Disposition',

    'Vary':
      'Origin',
  }
}

// ============================================================
// UTILITY
// ============================================================

function enc(value) {
  return encodeURIComponent(
    value
  )
}

function safeObjectName(
  value
) {
  return String(
    value || 'recording'
  )
    .replace(
      /[^\w.\-() ]+/g,
      '_'
    )
    .slice(
      0,
      180
    )
}

function slugify(value) {
  return (
    String(
      value || 'event'
    )
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      ) || 'event'
  )
}

// ============================================================
// UNIQUE EVENT SLUG
// ============================================================

async function uniqueSlug(
  env,
  base
) {
  let slug = base

  for (
    let i = 0;
    i < 20;
    i += 1
  ) {
    const rows =
      await sb(
        env,
        `/events?slug=eq.${enc(slug)}` +
          `&select=id` +
          `&limit=1`
      )

    if (!rows.length) {
      return slug
    }

    slug =
      `${base}-${i + 2}`
  }

  return `${base}-${Date.now()}`
}

// ============================================================
// SAFE JSON BODY
// ============================================================

async function safeBody(
  request
) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

// ============================================================
// SUPABASE HEADERS
// ============================================================

function serviceHeaders(
  env
) {
  return {
    apikey:
      env.SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  }
}

function preferHeaders(
  env
) {
  return {
    ...serviceHeaders(env),

    'Content-Type':
      'application/json',

    Prefer:
      'return=representation',
  }
}

function minHeaders(
  env
) {
  return {
    ...serviceHeaders(env),

    Prefer:
      'return=minimal',
  }
}

// ============================================================
// SUPABASE REST HELPER
// ============================================================

async function sb(
  env,
  path,
  options = {}
) {
  const fullUrl =
    `${env.SUPABASE_URL}` +
    `/rest/v1${path}`

  const response =
    await fetch(
      fullUrl,
      {
        ...options,

        headers: {
          ...serviceHeaders(
            env
          ),

          ...(options.headers ||
            {}),
        },
      }
    )

  const text =
    await response.text()

  let data = null

  if (text) {
    try {
      data =
        JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const details =
      typeof data ===
      'object'
        ? JSON.stringify(
            data
          )
        : String(
            data || ''
          )

    console.error(
      'SUPABASE REQUEST FAILED',
      {
        status:
          response.status,

        statusText:
          response.statusText,

        path,

        details,
      }
    )

    throw new Error(
      `Supabase ${response.status}: ${
        details ||
        response.statusText ||
        'Unknown Supabase error'
      }`
    )
  }

  return data ?? []
}

// ============================================================
// VERIFY SUPABASE LOGIN
// ============================================================

async function verifySupabaseUser(
  request,
  env
) {
  const authorization =
    request.headers.get(
      'Authorization'
    )

  if (
    !authorization ||
    !authorization.startsWith(
      'Bearer '
    )
  ) {
    return {
      ok: false,
      error:
        'Authentication required',
    }
  }

  const response =
    await fetch(
      `${env.SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey:
            env.SUPABASE_SERVICE_ROLE_KEY,

          Authorization:
            authorization,
        },
      }
    )

  if (!response.ok) {
    return {
      ok: false,
      error:
        'Invalid or expired login session',
    }
  }

  return {
    ok: true,
    user:
      await response.json(),
  }
}

// ============================================================
// ACTIVITY LOG
// ============================================================

async function logActivity(
  env,
  userId,
  action,
  entityType,
  entityId,
  details = {}
) {
  try {
    await sb(
      env,
      '/activity_logs',
      {
        method: 'POST',

        headers: {
          ...serviceHeaders(
            env
          ),

          'Content-Type':
            'application/json',

          Prefer:
            'return=minimal',
        },

        body:
          JSON.stringify({
            user_id:
              userId,

            action,

            entity_type:
              entityType,

            entity_id:
              entityId,

            details,
          }),
      }
    )
  } catch (error) {
    console.error(
      'Activity log failed:',
      error?.message ||
        error
    )
  }
}

// ============================================================
// STREAM AUDIO FROM R2
// ============================================================

async function streamR2Audio(
  request,
  env,
  message,
  corsHeaders,
  forceDownload
) {
  const range =
    request.headers.get(
      'Range'
    )

  let object

  if (range) {
    object =
      await env.AUDIO_BUCKET.get(
        message.file_path,
        {
          range:
            request.headers,
        }
      )
  } else {
    object =
      await env.AUDIO_BUCKET.get(
        message.file_path
      )
  }

  if (!object) {
    return json(
      {
        error:
          'Audio file not found in R2',
      },
      404,
      corsHeaders
    )
  }

  const headers =
    new Headers(
      corsHeaders
    )

  object.writeHttpMetadata(
    headers
  )

  if (
    object.httpEtag
  ) {
    headers.set(
      'ETag',
      object.httpEtag
    )
  }

  headers.set(
    'Accept-Ranges',
    'bytes'
  )

  if (
    range &&
    object.range
  ) {
    const {
      offset,
      length,
    } =
      object.range

    headers.set(
      'Content-Range',
      `bytes ${offset}-${
        offset +
        length -
        1
      }/${object.size}`
    )

    headers.set(
      'Content-Length',
      String(length)
    )
  } else {
    headers.set(
      'Content-Length',
      String(
        object.size
      )
    )
  }

  if (forceDownload) {
    const name =
      String(
        message.file_name ||
          'recording'
      ).replace(
        /["\r\n]/g,
        ''
      )

    headers.set(
      'Content-Disposition',
      `attachment; filename="${name}"`
    )
  }

  return new Response(
    object.body,
    {
      status:
        range &&
        object.range
          ? 206
          : 200,

      headers,
    }
  )
}

// ============================================================
// PURGE TRASH OLDER THAN 30 DAYS
// ============================================================

async function purgeExpiredTrash(
  env
) {
  const cutoff =
    new Date(
      Date.now() -
        30 *
          24 *
          60 *
          60 *
          1000
    ).toISOString()

  try {
    const rows =
      await sb(
        env,
        `/messages?deleted_at=lt.${enc(cutoff)}` +
          `&select=id,file_path`
      )

    for (
      const message of rows
    ) {
      if (
        message.file_path
      ) {
        await env.AUDIO_BUCKET.delete(
          message.file_path
        )
      }
    }

    if (rows.length) {
      await sb(
        env,
        `/messages?deleted_at=lt.${enc(cutoff)}`,
        {
          method:
            'DELETE',

          headers:
            minHeaders(env),
        }
      )
    }
  } catch (error) {
    console.error(
      'Scheduled trash purge failed:',
      error?.message ||
        error
    )
  }
}

// ============================================================
// JSON RESPONSE
// ============================================================

function json(
  data,
  status,
  corsHeaders
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        ...corsHeaders,

        'Content-Type':
          'application/json',

        'Cache-Control':
          'no-store',
      },
    }
  )
}