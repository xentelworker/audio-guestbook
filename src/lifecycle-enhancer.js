import './lifecycle.css'

const API_URL = import.meta.env.VITE_AUDIO_API_URL

function formatDate(value) {
  if (!value) return ''

  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function daysRemaining(value) {
  if (!value) return null

  const target = new Date(value)
  const now = new Date()
  const diff = target.getTime() - now.getTime()

  return Math.max(0, Math.ceil(diff / 86400000))
}

function bannerMarkup(event) {
  if (!('auto_archive_enabled' in event)) {
    return ''
  }

  if (event.archived_at) {
    return `
      <div class="client-cycle-banner client-cycle-banner-archived">
        <div class="client-cycle-badge">EVENT CYCLE</div>
        <div>
          <strong>This event is archived</strong>
          <span>Archived ${formatDate(event.archived_at)}. Your audio memories remain available here.</span>
        </div>
      </div>
    `
  }

  if (!event.auto_archive_enabled) {
    return `
      <div class="client-cycle-banner client-cycle-banner-open">
        <div class="client-cycle-badge">EVENT CYCLE</div>
        <div>
          <strong>No automatic archive</strong>
          <span>This guestbook does not currently have an automatic expiry date.</span>
        </div>
      </div>
    `
  }

  if (!event.auto_archive_at) {
    return `
      <div class="client-cycle-banner client-cycle-banner-active">
        <div class="client-cycle-badge">EVENT CYCLE</div>
        <div>
          <strong>Automatic archive is enabled</strong>
          <span>The 3-month event cycle begins when an event date is set.</span>
        </div>
      </div>
    `
  }

  const remaining = daysRemaining(event.auto_archive_at)
  const remainingText =
    remaining === 0
      ? 'Archives today'
      : remaining === 1
        ? '1 day remaining'
        : `${remaining} days remaining`

  return `
    <div class="client-cycle-banner client-cycle-banner-active">
      <div class="client-cycle-badge">EVENT CYCLE</div>
      <div>
        <strong>${remainingText}</strong>
        <span>This guestbook is available until ${formatDate(event.auto_archive_at)}.</span>
      </div>
    </div>
  `
}

async function addLifecycleBanner() {
  const match = window.location.pathname.match(/^\/guestbook\/([^/]+)\/?$/)

  if (!match || !API_URL) return

  const slug = decodeURIComponent(match[1])

  try {
    const response = await fetch(
      `${API_URL}/public/event/${encodeURIComponent(slug)}`
    )

    if (!response.ok) return

    const event = await response.json()
    const markup = bannerMarkup(event)

    if (!markup) return

    const inject = () => {
      if (document.querySelector('.client-cycle-banner')) return true

      const header = document.querySelector('.public-gallery-header')
      if (!header) return false

      header.insertAdjacentHTML('afterend', markup)
      return true
    }

    if (inject()) return

    const observer = new MutationObserver(() => {
      if (inject()) observer.disconnect()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    window.setTimeout(() => observer.disconnect(), 10000)
  } catch (error) {
    console.warn('Unable to load event lifecycle banner:', error)
  }
}

addLifecycleBanner()
