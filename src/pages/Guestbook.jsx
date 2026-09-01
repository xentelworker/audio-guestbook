import { useEffect, useState } from 'react'
import JSZip from 'jszip'

const API_URL = import.meta.env.VITE_AUDIO_API_URL

function Guestbook({ slug }) {
  const [event, setEvent] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [audioUrls, setAudioUrls] = useState({})
  const [audioLoadingId, setAudioLoadingId] = useState(null)
  const [downloadAllStatus, setDownloadAllStatus] = useState('')

  useEffect(() => {
    loadGallery()

    return () => {
      Object.values(audioUrls).forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [slug])

  async function loadGallery() {
    setLoading(true)
    setError('')

    try {
      const [eventResponse, messagesResponse] =
        await Promise.all([
          fetch(
            `${API_URL}/public/event/${encodeURIComponent(slug)}`
          ),
          fetch(
            `${API_URL}/public/messages/${encodeURIComponent(slug)}`
          ),
        ])

      const eventData = await eventResponse.json()
      const messageData = await messagesResponse.json()

      if (!eventResponse.ok) {
        throw new Error(
          eventData.error || 'Unable to load event.'
        )
      }

      if (!messagesResponse.ok) {
        throw new Error(
          messageData.error || 'Unable to load messages.'
        )
      }

      setEvent(eventData)
      setMessages(messageData || [])
    } catch (error) {
      console.error('Gallery error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadAudio(message) {
    if (audioUrls[message.id]) {
      const player =
        document.getElementById(
          `public-audio-${message.id}`
        )

      if (player) {
        try {
          await player.play()
        } catch {
          // User can press native play button.
        }
      }

      return
    }

    setAudioLoadingId(message.id)

    try {
      const response = await fetch(
        `${API_URL}/public/audio/${encodeURIComponent(
          message.id
        )}`
      )

      if (!response.ok) {
        let messageText =
          'Unable to load recording.'

        try {
          const data = await response.json()

          messageText =
            data.error ||
            data.message ||
            messageText
        } catch {
          // Response may be binary.
        }

        throw new Error(messageText)
      }

      const blob = await response.blob()

      if (!blob.size) {
        throw new Error(
          'The audio file is empty.'
        )
      }

      const objectUrl =
        URL.createObjectURL(blob)

      setAudioUrls((current) => ({
        ...current,
        [message.id]: objectUrl,
      }))

      setTimeout(async () => {
        const player =
          document.getElementById(
            `public-audio-${message.id}`
          )

        if (player) {
          try {
            await player.play()
          } catch {
            // Browser may require user to press play again.
          }
        }
      }, 100)
    } catch (error) {
      console.error(
        'Public audio playback error:',
        error
      )

      alert(error.message)
    } finally {
      setAudioLoadingId(null)
    }
  }

  async function downloadMessage(message) {
    try {
      const response = await fetch(
        `${API_URL}/public/audio/${encodeURIComponent(
          message.id
        )}?download=1`
      )

      if (!response.ok) {
        throw new Error(
          'Unable to download recording.'
        )
      }

      const blob = await response.blob()
      const objectUrl =
        URL.createObjectURL(blob)

      const link =
        document.createElement('a')

      link.href = objectUrl
      link.download =
        message.file_name ||
        `message-${message.message_number}`

      document.body.appendChild(link)

      link.click()
      link.remove()

      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      alert(error.message)
    }
  }

  async function downloadAllMessages() {
    if (!messages.length || downloadAllStatus) {
      return
    }

    try {
      const zip = new JSZip()
      const usedNames = new Set()

      for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index]

        setDownloadAllStatus(
          `Downloading ${index + 1} of ${messages.length}...`
        )

        const response = await fetch(
          `${API_URL}/public/audio/${encodeURIComponent(
            message.id
          )}?download=1`
        )

        if (!response.ok) {
          throw new Error(
            `Unable to download Message ${message.message_number}.`
          )
        }

        const blob = await response.blob()

        let fileName =
          message.file_name ||
          `message-${message.message_number}.mp3`

        fileName = sanitizeFileName(fileName)

        if (!fileName.includes('.')) {
          fileName += '.mp3'
        }

        const originalName = fileName
        let duplicateNumber = 2

        while (usedNames.has(fileName.toLowerCase())) {
          const dotIndex = originalName.lastIndexOf('.')

          if (dotIndex > 0) {
            fileName =
              `${originalName.slice(0, dotIndex)}-${duplicateNumber}` +
              originalName.slice(dotIndex)
          } else {
            fileName = `${originalName}-${duplicateNumber}`
          }

          duplicateNumber += 1
        }

        usedNames.add(fileName.toLowerCase())
        zip.file(fileName, blob)
      }

      setDownloadAllStatus('Creating ZIP...')

      const zipBlob = await zip.generateAsync({
        type: 'blob',
      })

      const objectUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')

      link.href = objectUrl
      link.download =
        `${sanitizeFileName(event.name || 'Audio Guestbook')}` +
        '-Audio-Guestbook.zip'

      document.body.appendChild(link)
      link.click()
      link.remove()

      URL.revokeObjectURL(objectUrl)

      setDownloadAllStatus('Download ready')

      setTimeout(() => {
        setDownloadAllStatus('')
      }, 2000)
    } catch (error) {
      console.error('Download all error:', error)
      alert(error.message)
      setDownloadAllStatus('')
    }
  }

  if (loading) {
    return (
      <div className="public-gallery-page">
        <div className="public-gallery-card">
          Loading audio guestbook...
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="public-gallery-page">
        <div className="public-gallery-card">
          <div className="public-gallery-icon">
            🎙
          </div>

          <h1>
            Guestbook unavailable
          </h1>

          <p>
            {error ||
              'This audio guestbook could not be found.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-gallery-page">
      <div className="public-gallery-container">

        <header className="public-gallery-header">
          <div className="public-gallery-icon">
            🎙
          </div>

          <div className="public-gallery-kicker">
            AUDIO GUESTBOOK
          </div>

          <h1>{event.name}</h1>

          <p className="public-gallery-date">
            {formatDate(event.event_date)}
          </p>

          {event.description && (
            <p className="public-gallery-description">
              {event.description}
            </p>
          )}
        </header>

        <section className="public-gallery-summary">
          <strong>
            {messages.length}{' '}
            {messages.length === 1
              ? 'Message'
              : 'Messages'}
          </strong>

          <span>
            {formatDuration(
              messages.reduce(
                (total, message) =>
                  total +
                  Number(
                    message.duration || 0
                  ),
                0
              )
            )}{' '}
            total audio
          </span>

          {messages.length > 0 && (
            <button
              type="button"
              className="public-download-button"
              onClick={downloadAllMessages}
              disabled={Boolean(downloadAllStatus)}
            >
              {downloadAllStatus || '↓ Download All'}
            </button>
          )}
        </section>

        {messages.length === 0 ? (
          <div className="public-gallery-empty">
            <div className="public-gallery-icon">
              ♫
            </div>

            <h2>
              No messages yet
            </h2>

            <p>
              Audio messages for this event
              will appear here.
            </p>
          </div>
        ) : (
          <div className="public-message-list">

            {messages.map((message) => (

              <article
                className="public-message-card"
                key={message.id}
              >

                <div className="public-message-number">
                  {message.message_number}
                </div>

                <div className="public-message-main">

                  <div className="public-message-heading">

                    <div>
                      <h2>
                        {message.custom_label ||
                          `Message ${message.message_number}`}
                      </h2>

                      <p>
                        {formatDuration(
                          message.duration
                        )}

                        {' · '}

                        {formatFileSize(
                          message.file_size
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="public-download-button"
                      onClick={() =>
                        downloadMessage(
                          message
                        )
                      }
                    >
                      ↓ Download
                    </button>

                  </div>

                  {!audioUrls[message.id] ? (

                    <button
                      type="button"
                      className="public-download-button"
                      disabled={
                        audioLoadingId ===
                        message.id
                      }
                      onClick={() =>
                        loadAudio(message)
                      }
                    >
                      {audioLoadingId ===
                      message.id
                        ? 'Loading...'
                        : '▶ Play Recording'}
                    </button>

                  ) : (

                    <audio
                      id={`public-audio-${message.id}`}
                      className="public-audio-player"
                      src={
                        audioUrls[
                          message.id
                        ]
                      }
                      controls
                      preload="metadata"
                    />

                  )}

                </div>

              </article>
            ))}

          </div>
        )}

        <footer className="public-gallery-footer">
          Audio Guestbook
        </footer>

      </div>
    </div>
  )
}

function formatDate(date) {
  if (!date) return ''

  const parsedDate =
    new Date(
      `${date}T00:00:00`
    )

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return date
  }

  return parsedDate.toLocaleDateString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  )
}

function formatDuration(seconds) {
  const totalSeconds =
    Number(seconds || 0)

  const hours =
    Math.floor(
      totalSeconds / 3600
    )

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
        60
    )

  const remainingSeconds =
    Math.floor(
      totalSeconds % 60
    )

  if (hours > 0) {
    return `${hours}:${String(
      minutes
    ).padStart(
      2,
      '0'
    )}:${String(
      remainingSeconds
    ).padStart(
      2,
      '0'
    )}`
  }

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(
    2,
    '0'
  )}`
}

function formatFileSize(bytes) {
  const size =
    Number(bytes || 0)

  if (!size) {
    return '0 B'
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
  ]

  const index =
    Math.min(
      Math.floor(
        Math.log(size) /
          Math.log(1024)
      ),
      units.length - 1
    )

  const value =
    size /
    1024 ** index

  return `${value.toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`
}

function sanitizeFileName(value) {
  return String(value || 'file')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export default Guestbook