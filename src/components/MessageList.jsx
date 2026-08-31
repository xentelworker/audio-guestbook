import { useState } from 'react'
import { formatDateTime, formatDuration, formatFileSize } from '../utils/formatters'

export default function MessageList({
  messages, selectedIds = [], onToggleSelect, onPlay, audioUrls = {},
  onDownload, onVisibility, onDelete, onRename, onReorder,
  showEventName = false, onOpenEvent
}) {
  const [dragId, setDragId] = useState(null)

  function drop(targetId) {
    if (!dragId || dragId === targetId) return
    const from = messages.findIndex(m => m.id === dragId)
    const to = messages.findIndex(m => m.id === targetId)
    if (from < 0 || to < 0) return
    const reordered = [...messages]
    const [moved] = reordered.splice(from,1)
    reordered.splice(to,0,moved)
    onReorder?.(reordered)
    setDragId(null)
  }

  return (
    <div className="message-list">
      {messages.map(message => (
        <article
          key={message.id}
          className={`message-card ${selectedIds.includes(message.id) ? 'message-card-selected' : ''}`}
          draggable={Boolean(onReorder)}
          onDragStart={() => setDragId(message.id)}
          onDragOver={e => onReorder && e.preventDefault()}
          onDrop={() => drop(message.id)}
        >
          {onToggleSelect && (
            <div className="message-select">
              <input type="checkbox" checked={selectedIds.includes(message.id)}
                onChange={() => onToggleSelect(message.id)} />
            </div>
          )}
          <div className="message-number">{message.message_number}</div>
          <div className="message-info">
            <div className="message-title-row">
              <div>
                <h3>{message.custom_label || `Message ${message.message_number}`}</h3>
                {showEventName && <p><strong>{message.event_name}</strong></p>}
                <p>{message.file_name || 'Recording'}</p>
              </div>
              <span className={`visibility-badge ${message.is_visible ? 'visible':'hidden'}`}>
                {message.is_visible ? 'Visible' : 'Hidden'}
              </span>
            </div>

            <div className="message-meta">
              <span>{formatDuration(message.duration)}</span>
              <span>{formatFileSize(message.file_size)}</span>
              <span>{formatDateTime(message.created_at)}</span>
              {onReorder && <span title="Drag to reorder">↕ Drag</span>}
            </div>

            {audioUrls[message.id] && (
              <audio id={`admin-audio-${message.id}`} className="admin-audio-player"
                src={audioUrls[message.id]} controls />
            )}

            <div className="message-actions">
              <button onClick={() => onPlay(message)}>▶ Play</button>
              <button onClick={() => onDownload(message)}>↓ Download</button>
              <button onClick={() => onVisibility(message)}>{message.is_visible ? '👁 Hide':'👁 Show'}</button>
              {onRename && <button onClick={() => onRename(message)}>✎ Label</button>}
              {showEventName && onOpenEvent && <button onClick={() => onOpenEvent(message)}>Open Event →</button>}
              <button className="danger-button" onClick={() => onDelete(message)}>🗑 Trash</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
