import { useEffect, useState } from 'react'
import JSZip from 'jszip'
import { API_URL } from '../services/api'
import { formatDate, formatDuration, formatFileSize, getFileExtension } from '../utils/formatters'

export default function Guestbook({ slug }) {
  const [event, setEvent] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingAll, setDownloadingAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!API_URL) throw new Error('Audio API is not configured.')
        const [eventResponse, messagesResponse] = await Promise.all([
          fetch(`${API_URL}/public/event/${encodeURIComponent(slug)}`),
          fetch(`${API_URL}/public/messages/${encodeURIComponent(slug)}`),
        ])
        const eventData = await eventResponse.json()
        const messageData = await messagesResponse.json()
        if (!eventResponse.ok) throw new Error(eventData.error || 'Guestbook unavailable.')
        if (!messagesResponse.ok) throw new Error(messageData.error || 'Messages unavailable.')
        if (!cancelled) { setEvent(eventData); setMessages(messageData) }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  async function downloadMessage(message) {
    const response = await fetch(`${API_URL}/public/audio/${encodeURIComponent(message.id)}?download=1`)
    if (!response.ok) return alert('Unable to download this recording.')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = message.file_name || `message-${message.message_number}`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  async function downloadAll() {
    setDownloadingAll(true)
    try {
      const zip = new JSZip()
      for (let i=0; i<messages.length; i++) {
        const message=messages[i]
        const response=await fetch(`${API_URL}/public/audio/${encodeURIComponent(message.id)}?download=1`)
        if(!response.ok) throw new Error(`Unable to download message ${message.message_number}.`)
        const blob=await response.blob()
        const title = message.custom_label || `Message-${String(message.message_number).padStart(3,'0')}`
        zip.file(`${title}${getFileExtension(message.file_name)}`, blob)
      }
      const blob=await zip.generateAsync({type:'blob'})
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a')
      a.href=url; a.download=`${event.slug}-audio-guestbook.zip`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch(e) { alert(e.message) } finally { setDownloadingAll(false) }
  }

  if (loading) return <div className="public-gallery-page"><div className="public-gallery-card">Loading audio guestbook...</div></div>
  if (error || !event) return <div className="public-gallery-page"><div className="public-gallery-card"><div className="public-gallery-icon">🎙</div><h1>Guestbook unavailable</h1><p>{error || 'This audio guestbook could not be found.'}</p></div></div>

  const totalDuration = messages.reduce((sum,m)=>sum+Number(m.duration||0),0)

  return (
    <div className="public-gallery-page">
      <div className="public-gallery-container">
        <header className="public-gallery-header">
          <div className="public-gallery-icon">🎙</div>
          <div className="public-gallery-kicker">AUDIO GUESTBOOK</div>
          <h1>{event.name}</h1>
          {event.event_date && <p className="public-gallery-date">{formatDate(event.event_date)}</p>}
          {event.description && <p className="public-gallery-description">{event.description}</p>}
        </header>

        <section className="public-gallery-summary">
          <div><strong>{messages.length} {messages.length === 1 ? 'Message':'Messages'}</strong><span>{formatDuration(totalDuration)} total audio</span></div>
          {!!messages.length && <button disabled={downloadingAll} onClick={downloadAll}>{downloadingAll?'Preparing ZIP...':'↓ Download All'}</button>}
        </section>

        {!messages.length ? (
          <div className="public-gallery-empty"><div className="public-gallery-icon">♫</div><h2>No messages yet</h2></div>
        ) : (
          <div className="public-message-list">
            {messages.map(message=>(
              <article className="public-message-card" key={message.id}>
                <div className="public-message-number">{message.message_number}</div>
                <div className="public-message-main">
                  <div className="public-message-heading">
                    <div><h2>{message.custom_label || `Message ${message.message_number}`}</h2><p>{formatDuration(message.duration)} · {formatFileSize(message.file_size)}</p></div>
                    <button className="public-download-button" onClick={()=>downloadMessage(message)}>↓ Download</button>
                  </div>
                  <audio className="public-audio-player" src={`${API_URL}/public/audio/${encodeURIComponent(message.id)}`} controls preload="metadata" />
                </div>
              </article>
            ))}
          </div>
        )}
        <footer className="public-gallery-footer">Audio Guestbook</footer>
      </div>
    </div>
  )
}
