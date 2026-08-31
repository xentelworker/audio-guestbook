import { useEffect, useState } from 'react'
import JSZip from 'jszip'

const API_URL =
  import.meta.env.VITE_AUDIO_API_URL

function Guestbook({ slug }) {
  const [event, setEvent] =
    useState(null)

  const [messages, setMessages] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [
    downloadingAll,
    setDownloadingAll,
  ] = useState(false)

  useEffect(() => {
    loadGallery()
  }, [slug])

  async function loadGallery() {
    setLoading(true)
    setError('')

    try {
      const [
        eventResponse,
        messagesResponse,
      ] = await Promise.all([
        fetch(
          `${API_URL}/public/event/${encodeURIComponent(
            slug
          )}`
        ),

        fetch(
          `${API_URL}/public/messages/${encodeURIComponent(
            slug
          )}`
        ),
      ])

      const eventData =
        await eventResponse.json()

      const messageData =
        await messagesResponse.json()

      if (!eventResponse.ok) {
        throw new Error(
          eventData.error ||
            'Unable to load event.'
        )
      }

      if (!messagesResponse.ok) {
        throw new Error(
          messageData.error ||
            'Unable to load messages.'
        )
      }

      setEvent(eventData)
      setMessages(
        messageData || []
      )
    } catch (error) {
      console.error(
        'Gallery error:',
        error
      )

      setError(
        error.message
      )
    } finally {
      setLoading(false)
    }
  }

  async function downloadMessage(
    message
  ) {
    try {
      const response =
        await fetch(
          `${API_URL}/public/audio/${encodeURIComponent(
            message.id
          )}?download=1`
        )

      if (!response.ok) {
        throw new Error(
          'Unable to download recording.'
        )
      }

      const blob =
        await response.blob()

      const objectUrl =
        URL.createObjectURL(
          blob
        )

      const link =
        document.createElement(
          'a'
        )

      link.href =
        objectUrl

      link.download =
        message.file_name ||
        `message-${message.message_number}`

      document.body.appendChild(
        link
      )

      link.click()
      link.remove()

      URL.revokeObjectURL(
        objectUrl
      )
    } catch (error) {
      alert(
        error.message
      )
    }
  }

  async function downloadAllMessages() {
    if (
      messages.length ===
      0
    ) {
      return
    }

    setDownloadingAll(true)

    try {
      const zip =
        new JSZip()

      for (
        let index = 0;
        index <
        messages.length;
        index++
      ) {
        const message =
          messages[index]

        const response =
          await fetch(
            `${API_URL}/public/audio/${encodeURIComponent(
              message.id
            )}?download=1`
          )

        if (!response.ok) {
          throw new Error(
            `Unable to download Message ${message.message_number}.`
          )
        }

        const blob =
          await response.blob()

        const extension =
          getFileExtension(
            message.file_name
          )

        const zipFileName =
          `Message-${String(
            message.message_number
          ).padStart(
            3,
            '0'
          )}${extension}`

        zip.file(
          zipFileName,
          blob
        )
      }

      const zipBlob =
        await zip.generateAsync({
          type: 'blob',
        })

      const objectUrl =
        URL.createObjectURL(
          zipBlob
        )

      const link =
        document.createElement(
          'a'
        )

      link.href =
        objectUrl

      link.download =
        `${event.slug}-audio-guestbook.zip`

      document.body.appendChild(
        link
      )

      link.click()
      link.remove()

      URL.revokeObjectURL(
        objectUrl
      )
    } catch (error) {
      console.error(
        'Public ZIP download error:',
        error
      )

      alert(
        error.message
      )
    } finally {
      setDownloadingAll(
        false
      )
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

  if (
    error ||
    !event
  ) {
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

  const totalDuration =
    messages.reduce(
      (
        total,
        message
      ) =>
        total +
        Number(
          message.duration ||
            0
        ),
      0
    )

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

          <h1>
            {event.name}
          </h1>

          <p className="public-gallery-date">
            {formatDate(
              event.event_date
            )}
          </p>

          {event.description && (
            <p className="public-gallery-description">
              {event.description}
            </p>
          )}

        </header>

        <section className="public-gallery-summary">

          <div>
            <strong>
              {messages.length}{' '}
              {messages.length === 1
                ? 'Message'
                : 'Messages'}
            </strong>

            <span>
              {formatDuration(
                totalDuration
              )}{' '}
              total audio
            </span>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={
                downloadAllMessages
              }
              disabled={
                downloadingAll
              }
            >
              {downloadingAll
                ? 'Preparing ZIP...'
                : '↓ Download All'}
            </button>
          )}

        </section>

        {messages.length === 0 && (
          <div className="public-gallery-empty">

            <div className="public-gallery-icon">
              ♫
            </div>

            <h2>
              No messages yet
            </h2>

            <p>
              Audio messages for this event will appear here.
            </p>

          </div>
        )}

        {messages.length > 0 && (
          <div className="public-message-list">

            {messages.map(
              (message) => (
                <article
                  className="public-message-card"
                  key={
                    message.id
                  }
                >

                  <div className="public-message-number">
                    {
                      message.message_number
                    }
                  </div>

                  <div className="public-message-main">

                    <div className="public-message-heading">

                      <div>

                        <h2>
                          Message{' '}
                          {
                            message.message_number
                          }
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

                    <audio
                      className="public-audio-player"
                      src={`${API_URL}/public/audio/${encodeURIComponent(
                        message.id
                      )}`}
                      controls
                      preload="metadata"
                    />

                  </div>

                </article>
              )
            )}

          </div>
        )}

        <footer className="public-gallery-footer">
          Audio Guestbook
        </footer>

      </div>

    </div>
  )
}

function formatDate(
  date
) {
  if (!date) {
    return ''
  }

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
    'en-CA',
    {
      month:
        'long',

      day:
        'numeric',

      year:
        'numeric',
    }
  )
}

function formatDuration(
  seconds
) {
  const totalSeconds =
    Number(
      seconds || 0
    )

  const hours =
    Math.floor(
      totalSeconds /
        3600
    )

  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) /
        60
    )

  const remainingSeconds =
    Math.floor(
      totalSeconds %
        60
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

function formatFileSize(
  bytes
) {
  const size =
    Number(
      bytes || 0
    )

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
        Math.log(
          size
        ) /
          Math.log(
            1024
          )
      ),
      units.length -
        1
    )

  const value =
    size /
    1024 ** index

  return `${value.toFixed(
    index === 0
      ? 0
      : 1
  )} ${units[index]}`
}

function getFileExtension(
  fileName
) {
  if (!fileName) {
    return '.mp3'
  }

  const lastDot =
    fileName.lastIndexOf(
      '.'
    )

  if (
    lastDot === -1
  ) {
    return '.mp3'
  }

  return fileName.substring(
    lastDot
  )
}

export default Guestbook