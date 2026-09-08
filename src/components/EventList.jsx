import { useState } from 'react'
import { formatDate } from '../utils/formatters'
import { apiJson } from '../services/api'

function lifecycleText(event) {
  if (!('auto_archive_enabled' in event)) return 'Lifecycle update pending'
  if (event.archived_at) return 'Archived'
  if (!event.auto_archive_enabled) return 'Auto archive off'

  const archiveDate = event.auto_archive_at
    ? new Date(event.auto_archive_at)
    : null

  if (!archiveDate || Number.isNaN(archiveDate.getTime())) {
    return 'Auto archive on · needs event date'
  }

  return `Auto archives ${archiveDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })}`
}

function displayOrder(events) {
  if (!events.length || !events.some((event) => event.created_at)) return events

  const eventDateDescending = [...events].sort((a, b) => {
    const aDate = a.event_date || ''
    const bDate = b.event_date || ''
    return bDate.localeCompare(aDate)
  })

  const looksLikeDefaultNewestOrder = events.every(
    (event, index) => event.id === eventDateDescending[index]?.id
  )

  if (!looksLikeDefaultNewestOrder) return events

  return [...events].sort((a, b) => {
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
    return bCreated - aCreated
  })
}

export default function EventList({
  events, onOpen, onGallery, onDuplicate, onArchive, onDelete
}) {
  const [overrides, setOverrides] = useState({})
  const [savingId, setSavingId] = useState(null)

  if (!events.length) return <div className="empty-state"><h3>No matching events</h3></div>

  async function toggleAutoArchive(event) {
    if (!('auto_archive_enabled' in event)) return

    const effective = {
      ...event,
      ...(overrides[event.id] || {}),
    }

    const enabled = !Boolean(effective.auto_archive_enabled)
    setSavingId(event.id)

    try {
      const data = await apiJson(`/event/${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_archive_enabled: enabled }),
      })

      setOverrides((current) => ({
        ...current,
        [event.id]: {
          auto_archive_enabled:
            data.event?.auto_archive_enabled ?? enabled,
          auto_archive_started_at:
            data.event?.auto_archive_started_at ?? null,
          auto_archive_at:
            data.event?.auto_archive_at ?? null,
          archived_at:
            data.event?.archived_at ?? effective.archived_at,
        },
      }))
    } catch (error) {
      alert(error.message)
    } finally {
      setSavingId(null)
    }
  }

  const orderedEvents = displayOrder(events)

  return (
    <div className="events-list">
      {orderedEvents.map(originalEvent => {
        const event = {
          ...originalEvent,
          ...(overrides[originalEvent.id] || {}),
        }
        const lifecycleReady = 'auto_archive_enabled' in event

        return (
          <div className="event-row operational-event-row" key={event.id}>
            <button className="event-row-main" type="button" onClick={() => onOpen(event)}>
              <div>
                <strong>{event.name}</strong>
                <span>{formatDate(event.event_date)}</span>
                {event.archived_at && <span className="visibility-badge hidden">Archived</span>}
                <span className="event-lifecycle-summary">{lifecycleText(event)}</span>
              </div>
              <span>Open →</span>
            </button>
            <div className="event-row-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => onGallery(event)}
                title="Open the public client gallery in a new tab"
              >
                🌐 Client Gallery
              </button>
              <button
                type="button"
                onClick={() => toggleAutoArchive(event)}
                disabled={!lifecycleReady || savingId === event.id}
                title="Automatically archive this event after its three-month access cycle"
              >
                {!lifecycleReady
                  ? 'Auto Archive: Pending'
                  : savingId === event.id
                    ? 'Saving...'
                    : event.auto_archive_enabled
                      ? 'Auto Archive: On'
                      : 'Auto Archive: Off'}
              </button>
              <button type="button" onClick={() => onDuplicate(event)}>Duplicate</button>
              <button type="button" onClick={() => onArchive(event)}>
                {event.archived_at ? 'Unarchive' : 'Archive'}
              </button>
              <button type="button" className="danger-button" onClick={() => onDelete(event)}>Delete</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
