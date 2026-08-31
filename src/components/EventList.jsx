import { formatDate } from '../utils/formatters'

export default function EventList({
  events, onOpen, onGallery, onDuplicate, onArchive, onDelete
}) {
  if (!events.length) return <div className="empty-state"><h3>No matching events</h3></div>

  return (
    <div className="events-list">
      {events.map(event => (
        <div className="event-row operational-event-row" key={event.id}>
          <button className="event-row-main" type="button" onClick={() => onOpen(event)}>
            <div>
              <strong>{event.name}</strong>
              <span>{formatDate(event.event_date)}</span>
              {event.archived_at && <span className="visibility-badge hidden">Archived</span>}
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
            <button type="button" onClick={() => onDuplicate(event)}>Duplicate</button>
            <button type="button" onClick={() => onArchive(event)}>
              {event.archived_at ? 'Unarchive' : 'Archive'}
            </button>
            <button type="button" className="danger-button" onClick={() => onDelete(event)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
