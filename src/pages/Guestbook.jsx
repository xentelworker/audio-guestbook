import { useEffect, useRef, useState } from 'react'
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
  const [continuousPlay, setContinuousPlay] = useState(false)
  const [continuousIndex, setContinuousIndex] = useState(-1)
  const activePlaybackRequestRef = useRef(0)

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

  async function getOrLoadAudioUrl(message) {
    if (audioUrls[message.id]) {
      return audioUrls[message.id]
    }

    const response = await fetch(
      `${API_URL}/public/audio/${encodeURIComponent(
        message.id
      )}`
    )

    if (!response.ok) {
      let messageText = 'Unable to load recording.'

      try {
        const data = await response.json()

        messageText =
          data.error ||
          data.message ||
          messageText
      } catch {
        // Binary response.
      }

      throw new Error(messageText)
    }

    const blob = await response.blob()

    if (!blob.size) {
      throw new Error('The audio file is empty.')
    }

    const objectUrl = URL.createObjectURL(blob)

    setAudioUrls((current) => ({
      ...current,
      [message.id]: objectUrl,
    }))

    return objectUrl
  }

  function stopOtherAudioPlayers(activeMessageId = null) {
    const activeId =
      activeMessageId
        ? `public-audio-${activeMessageId}`
        : null

    document
      .querySelectorAll('audio')
      .forEach((player) => {
        if (!activeId || player.id !== activeId) {
          player.pause()

          try {
            player.currentTime = player.currentTime
          } catch {
            // Ignore browsers that do not allow this assignment.
          }
        }
      })
  }

  function beginNewPlaybackRequest() {
    activePlaybackRequestRef.current += 1
    return activePlaybackRequestRef.current
  }

  function isCurrentPlaybackRequest(requestId) {
    return (
      activePlaybackRequestRef.current === requestId
    )
  }

  async function loadAudio(message) {
    const requestId =
      beginNewPlaybackRequest()

    stopOtherAudioPlayers(message.id)

    if (continuousPlay) {
      setContinuousPlay(false)
      setContinuousIndex(-1)
    }

    try {
      setAudioLoadingId(message.id)

      await getOrLoadAudioUrl(message)

      if (!isCurrentPlaybackRequest(requestId)) {
        return
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 75)
      )

      if (!isCurrentPlaybackRequest(requestId)) {
        return
      }

      stopOtherAudioPlayers(message.id)

      const player =
        document.getElementById(
          `public-audio-${message.id}`
        )

      if (!player) {
        return
      }

      await player.play()
    } catch (error) {
      if (!isCurrentPlaybackRequest(requestId)) {
        return
      }

      console.error(
        'Public audio playback error:',
        error
      )

      alert(error.message)
    } finally {
      if (isCurrentPlaybackRequest(requestId)) {
        setAudioLoadingId(null)
      }
    }
  }

  async function playContinuousMessage(index) {
    if (
      index < 0 ||
      index >= messages.length
    ) {
      beginNewPlaybackRequest()
      stopOtherAudioPlayers()
      setContinuousPlay(false)
      setContinuousIndex(-1)
      return
    }

    const requestId =
      beginNewPlaybackRequest()

    const message =
      messages[index]

    stopOtherAudioPlayers(message.id)

    try {
      setContinuousPlay(true)
      setContinuousIndex(index)
      setAudioLoadingId(message.id)

      await getOrLoadAudioUrl(message)

      if (!isCurrentPlaybackRequest(requestId)) {
        return
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 75)
      )

      if (!isCurrentPlaybackRequest(requestId)) {
        return
      }

      stopOtherAudioPlayers(message.id)

      const player =
        document.getElementById(
          `public-audio-${message.id}`
        )

      if (!player) {
        return
      }

      await player.play()

      document
        .getElementById(
          `public-message-card-${message.id}`
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
    } catch (error) {
      if (!isCurrentPlaybackRequest(requestId)) {
        return
      }

      console.error(
        'Continuous playback error:',
        error
      )

      setContinuousPlay(false)
      setContinuousIndex(-1)

      alert(
        error?.message ||
        'Unable to play this recording.'
      )
    } finally {
      if (isCurrentPlaybackRequest(requestId)) {
        setAudioLoadingId(null)
      }
    }
  }

  function startContinuousPlay() {
    if (!messages.length) {
      return
    }

    if (continuousPlay) {
      stopContinuousPlay()
      return
    }

    playContinuousMessage(0)
  }

  function stopContinuousPlay() {
    beginNewPlaybackRequest()
    setContinuousPlay(false)
    setContinuousIndex(-1)
    setAudioLoadingId(null)
    stopOtherAudioPlayers()
  }

  function handleContinuousEnded(index) {
    if (!continuousPlay) {
      return
    }

    const nextIndex = index + 1

    if (nextIndex >= messages.length) {
      setContinuousPlay(false)
      setContinuousIndex(-1)
      return
    }

    playContinuousMessage(nextIndex)
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
              onClick={startContinuousPlay}
            >
              {continuousPlay
                ? '■ Stop Continuous Play'
                : '▶ Play All'}
            </button>
          )}

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

            {messages.map((message, index) => (

              <article
                id={`public-message-card-${message.id}`}
                className={
                  continuousIndex === index
                    ? 'public-message-card public-message-card-playing'
                    : 'public-message-card'
                }
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
                      onPlay={(event) => {
                        stopOtherAudioPlayers(message.id)

                        document
                          .querySelectorAll('audio')
                          .forEach((player) => {
                            if (player !== event.currentTarget) {
                              player.pause()
                            }
                          })

                        if (
                          continuousPlay &&
                          continuousIndex !== index
                        ) {
                          beginNewPlaybackRequest()
                          setContinuousPlay(false)
                          setContinuousIndex(-1)
                          setAudioLoadingId(null)
                        }
                      }}
                      onEnded={() =>
                        handleContinuousEnded(index)
                      }
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