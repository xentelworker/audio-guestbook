const API_URL =
  'https://audio-guestbook-api.snapbooth.workers.dev'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    const guestbookMatch =
      url.pathname.match(
        /^\/guestbook\/([^/]+)\/?$/
      )

    // ========================================================
    // NORMAL FRONTEND REQUESTS
    // ========================================================

    if (!guestbookMatch) {
      return env.ASSETS.fetch(request)
    }

    const slug =
      decodeURIComponent(
        guestbookMatch[1]
      )

    // ========================================================
    // IMPORTANT:
    // LOAD THE SPA USING THE ORIGINAL REQUEST
    //
    // Do NOT request /index.html directly.
    // Cloudflare will use the SPA fallback while keeping
    // /guestbook/:slug in the browser address bar.
    // ========================================================

    const assetResponse =
      await env.ASSETS.fetch(request)

    // ========================================================
    // GET PUBLIC EVENT INFORMATION
    // ========================================================

    let event = null
    let messages = []

    try {
      const response =
        await fetch(
          `${API_URL}/public/event/${encodeURIComponent(
            slug
          )}`
        )

      if (response.ok) {
        const data =
          await response.json()

        event =
          data.event ||
          data

        messages =
          Array.isArray(data.messages)
            ? data.messages
            : []
      }
    } catch (error) {
      console.error(
        'Unable to load social metadata:',
        error
      )
    }

    // If event metadata failed,
    // still return the normal working gallery.
    if (!event) {
      return assetResponse
    }

    // ========================================================
    // SOCIAL METADATA
    // ========================================================

    const eventName =
      event.name ||
      'Audio Guestbook'

    const title =
      `${eventName} — Audio Guestbook`

    const messageCount =
      messages.length

    let description

    if (messageCount === 1) {
      description =
        `Listen to an audio message from ${eventName}'s celebration.`
    } else if (messageCount > 1) {
      description =
        `Listen to ${messageCount} audio messages from ${eventName}'s celebration.`
    } else {
      description =
        `Listen to audio messages from ${eventName}'s celebration.`
    }

    const canonicalUrl =
      `${url.origin}/guestbook/${encodeURIComponent(
        slug
      )}`

    const previewImage =
      `${url.origin}/gallery-preview.jpg`

    // ========================================================
    // INJECT OPEN GRAPH METADATA
    // ========================================================

    return new HTMLRewriter()

      .on(
        'title',
        {
          element(element) {
            element.setInnerContent(
              title
            )
          },
        }
      )

      .on(
        'head',
        {
          element(element) {
            element.append(
              `
<meta name="description"
      content="${escapeHtml(description)}">

<meta property="og:title"
      content="${escapeHtml(title)}">

<meta property="og:description"
      content="${escapeHtml(description)}">

<meta property="og:image"
      content="${escapeHtml(previewImage)}">

<meta property="og:image:width"
      content="1200">

<meta property="og:image:height"
      content="630">

<meta property="og:url"
      content="${escapeHtml(canonicalUrl)}">

<meta property="og:type"
      content="website">

<meta property="og:site_name"
      content="SnapBooth Audio Guestbook">

<meta name="twitter:card"
      content="summary_large_image">

<meta name="twitter:title"
      content="${escapeHtml(title)}">

<meta name="twitter:description"
      content="${escapeHtml(description)}">

<meta name="twitter:image"
      content="${escapeHtml(previewImage)}">

<link rel="canonical"
      href="${escapeHtml(canonicalUrl)}">
              `,
              {
                html: true,
              }
            )
          },
        }
      )

      .transform(assetResponse)
  },
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}