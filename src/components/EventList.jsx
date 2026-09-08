import { useState } from 'react'
import { formatDate } from '../utils/formatters'
import { apiJson } from '../services/api'

function addThreeMonths(dateValue) {
  if (!dateValue) return null

  const [year, month, day] = String(dateValue)
    .split('-')
    .map(Number)

  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCMonth(date.getUTCMonth() + 3)
  return date
}

function lifecycleText(event) {
  if (event.archived_at) return 'Archived'
  if (!event.auto_archive_enabled) return 'Auto archive off'

  const archiveDate = addThreeMonths(event.event_date)
  if (!archiveDate) return 'Auto archive on · needs event date'

  return `Auto archives ${archiveDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })}`
}

export default function EventList({
  events, onOpen, onGallery, onDuplicate, onArchive, onDelete
}) {
  const [overrides, setOverrides] = useState({})
  const [savingId, setSavingId] = useState(null)

  if (!events.length) return <div className="empty-state"><h3>No matching events</h3></div>

  async function toggleAutoArchive(event) {
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

  return (
    <div className="events-list">
      {events.map(originalEvent => {
        const event = {
          ...originalEvent,
          ...(overrides[originalEvent.id] || {}),
        }

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
                disabled={savingId === event.id}
                title="Automatically archive this event three months after its event date"
              >
                {savingId === event.id
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
