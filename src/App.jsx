import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import './App.css'

function App() {
  // ============================================================
  // AUTH
  // ============================================================

  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // ============================================================
  // NAVIGATION
  // ============================================================

  const [page, setPage] = useState('dashboard')

  // ============================================================
  // EVENTS
  // ============================================================

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState('')

  // ============================================================
  // CREATE EVENT
  // ============================================================

  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [createEventError, setCreateEventError] = useState('')

  const [eventForm, setEventForm] = useState({
    name: '',
    event_date: '',
    description: '',
  })

  // ============================================================
  // AUTHENTICATION LISTENER
  // ============================================================

  useEffect(() => {
    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setCheckingAuth(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // ============================================================
  // LOAD EVENTS AFTER LOGIN
  // ============================================================

  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user])

  // ============================================================
  // CHECK CURRENT SESSION
  // ============================================================

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    setUser(session?.user ?? null)
    setCheckingAuth(false)
  }

  // ============================================================
  // LOAD EVENTS FROM SUPABASE
  // ============================================================

  async function loadEvents() {
    setEventsLoading(true)
    setEventsError('')

    const { data, error } = await supabase
      .from('events')
      .select(
        'id, name, slug, event_date, description'
      )
      .order('event_date', {
        ascending: false,
      })

    if (error) {
      console.error(
        'Error loading events:',
        error
      )

      setEventsError(error.message)
      setEventsLoading(false)

      return
    }

    setEvents(data || [])
    setEventsLoading(false)
  }

  // ============================================================
  // CREATE SLUG
  // ============================================================

  function createSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // ============================================================
  // CREATE EVENT
  // ============================================================

  async function handleCreateEvent(event) {
    event.preventDefault()

    setCreatingEvent(true)
    setCreateEventError('')

    const name = eventForm.name.trim()

    const slug = createSlug(name)

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!name) {
      setCreateEventError(
        'Please enter an event name.'
      )

      setCreatingEvent(false)

      return
    }

    if (!slug) {
      setCreateEventError(
        'Please enter an event name containing letters or numbers.'
      )

      setCreatingEvent(false)

      return
    }

    // ----------------------------------------------------------
    // INSERT INTO SUPABASE
    // ----------------------------------------------------------

    const { data, error } = await supabase
      .from('events')
      .insert({
        name,
        slug,
        event_date:
          eventForm.event_date || null,
        description:
          eventForm.description.trim() || null,
      })
      .select(
        'id, name, slug, event_date, description'
      )
      .single()

    // ----------------------------------------------------------
    // DATABASE ERROR
    // ----------------------------------------------------------

    if (error) {
      console.error(
        'Error creating event:',
        error
      )

      setCreateEventError(
        error.message
      )

      setCreatingEvent(false)

      return
    }

    // ----------------------------------------------------------
    // ADD NEW EVENT TO UI
    // ----------------------------------------------------------

    setEvents((currentEvents) => [
      data,
      ...currentEvents,
    ])

    // ----------------------------------------------------------
    // RESET FORM
    // ----------------------------------------------------------

    setEventForm({
      name: '',
      event_date: '',
      description: '',
    })

    // ----------------------------------------------------------
    // CLOSE MODAL
    // ----------------------------------------------------------

    setShowCreateEvent(false)

    setCreatingEvent(false)
  }

  // ============================================================
  // OPEN CREATE EVENT MODAL
  // ============================================================

  function openCreateEvent() {
    setCreateEventError('')

    setEventForm({
      name: '',
      event_date: '',
      description: '',
    })

    setShowCreateEvent(true)
  }

  // ============================================================
  // CLOSE CREATE EVENT MODAL
  // ============================================================

  function closeCreateEvent() {
    if (creatingEvent) {
      return
    }

    setShowCreateEvent(false)

    setCreateEventError('')

    setEventForm({
      name: '',
      event_date: '',
      description: '',
    })
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    await supabase.auth.signOut()

    setUser(null)
    setPage('dashboard')
    setEvents([])
  }

  // ============================================================
  // INITIAL LOADING
  // ============================================================

  if (checkingAuth) {
    return (
      <div className="login-page">
        <div>
          Loading...
        </div>
      </div>
    )
  }

  // ============================================================
  // LOGIN
  // ============================================================

  if (!user) {
    return (
      <Login
        onLogin={setUser}
      />
    )
  }

  // ============================================================
  // APPLICATION
  // ============================================================

  return (
    <div className="app">

      {/* ======================================================
          CREATE EVENT MODAL
      ====================================================== */}

      {showCreateEvent && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeCreateEvent()
            }
          }}
        >

          <div className="modal">

            {/* Modal Header */}

            <div className="modal-header">

              <div>
                <h2>
                  Create Event
                </h2>

                <p>
                  Create a new audio guestbook event
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeCreateEvent}
                disabled={creatingEvent}
              >
                ×
              </button>

            </div>


            {/* Create Event Form */}

            <form
              onSubmit={handleCreateEvent}
            >

              {/* Event Name */}

              <div className="form-group">

                <label>
                  Event Name
                </label>

                <input
                  type="text"
                  placeholder="John & Jane Wedding"
                  value={eventForm.name}
                  onChange={(event) => {
                    setEventForm({
                      ...eventForm,
                      name: event.target.value,
                    })
                  }}
                  disabled={creatingEvent}
                  required
                />

              </div>


              {/* Event Date */}

              <div className="form-group">

                <label>
                  Event Date
                </label>

                <input
                  type="date"
                  value={
                    eventForm.event_date
                  }
                  onChange={(event) => {
                    setEventForm({
                      ...eventForm,
                      event_date:
                        event.target.value,
                    })
                  }}
                  disabled={creatingEvent}
                />

              </div>


              {/* Description */}

              <div className="form-group">

                <label>
                  Description
                </label>

                <textarea
                  placeholder="Wedding audio guestbook"
                  rows="4"
                  value={
                    eventForm.description
                  }
                  onChange={(event) => {
                    setEventForm({
                      ...eventForm,
                      description:
                        event.target.value,
                    })
                  }}
                  disabled={creatingEvent}
                />

              </div>


              {/* Error */}

              {createEventError && (
                <div className="login-error">

                  <strong>
                    Unable to create event
                  </strong>

                  <br />

                  {createEventError}

                </div>
              )}


              {/* Buttons */}

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCreateEvent}
                  disabled={creatingEvent}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={creatingEvent}
                >
                  {creatingEvent
                    ? 'Creating...'
                    : 'Create Event'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside className="sidebar">

        {/* Brand */}

        <div className="sidebar-brand">

          <div className="brand-icon">
            🎙
          </div>

          <div>

            <div className="brand-title">
              Audio Guestbook
            </div>

            <div className="brand-subtitle">
              Client Portal
            </div>

          </div>

        </div>


        {/* Navigation */}

        <nav className="sidebar-nav">

          <button
            className={`nav-item ${
              page === 'dashboard'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setPage('dashboard')
            }
          >
            <span className="nav-icon">
              ▦
            </span>

            Dashboard
          </button>


          <button
            className={`nav-item ${
              page === 'events'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setPage('events')
            }
          >
            <span className="nav-icon">
              ◉
            </span>

            Events
          </button>


          <button
            className={`nav-item ${
              page === 'messages'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setPage('messages')
            }
          >
            <span className="nav-icon">
              ♫
            </span>

            Messages
          </button>


          <button
            className={`nav-item ${
              page === 'settings'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setPage('settings')
            }
          >
            <span className="nav-icon">
              ⚙
            </span>

            Settings
          </button>

        </nav>


        {/* Account */}

        <div className="sidebar-bottom">

          <div className="account">

            <div className="avatar">
              AG
            </div>

            <div className="account-info">

              <div className="account-name">
                Admin
              </div>

              <div className="account-email">
                {user?.email}
              </div>

              <button
                type="button"
                className="logout-button"
                onClick={handleLogout}
              >
                Sign out
              </button>

            </div>

          </div>

        </div>

      </aside>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="main">

        {/* ====================================================
            DASHBOARD
        ==================================================== */}

        {page === 'dashboard' && (

          <>

            {/* Header */}

            <header className="page-header">

              <div>

                <h1>
                  Dashboard
                </h1>

                <p>
                  Manage your audio guestbook events
                </p>

              </div>

              <button
                type="button"
                className="primary-button"
                onClick={openCreateEvent}
              >
                + Create Event
              </button>

            </header>


            {/* Stats */}

            <section className="stats-grid">

              <div className="stat-card">

                <div className="stat-icon">
                  ◉
                </div>

                <div>

                  <div className="stat-label">
                    Active Events
                  </div>

                  <div className="stat-value">
                    {events.length}
                  </div>

                </div>

              </div>


              <div className="stat-card">

                <div className="stat-icon">
                  ♫
                </div>

                <div>

                  <div className="stat-label">
                    Total Messages
                  </div>

                  <div className="stat-value">
                    —
                  </div>

                </div>

              </div>


              <div className="stat-card">

                <div className="stat-icon">
                  ◷
                </div>

                <div>

                  <div className="stat-label">
                    Audio Hours
                  </div>

                  <div className="stat-value">
                    —
                  </div>

                </div>

              </div>


              <div className="stat-card">

                <div className="stat-icon">
                  ▣
                </div>

                <div>

                  <div className="stat-label">
                    Storage Used
                  </div>

                  <div className="stat-value">
                    —
                  </div>

                </div>

              </div>

            </section>


            {/* Recent Events */}

            <section className="section">

              <div className="section-header">

                <div>

                  <h2>
                    Recent Events
                  </h2>

                  <p>
                    Your latest audio guestbook events
                  </p>

                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setPage('events')
                  }
                >
                  View all →
                </button>

              </div>


              {/* Loading */}

              {eventsLoading && (
                <div className="empty-state">
                  Loading events...
                </div>
              )}


              {/* Error */}

              {eventsError && (
                <div className="login-error">

                  <strong>
                    Unable to load events
                  </strong>

                  <br />

                  {eventsError}

                </div>
              )}


              {/* No Events */}

              {!eventsLoading &&
                !eventsError &&
                events.length === 0 && (

                  <div className="empty-state">

                    <div className="empty-icon">
                      ◉
                    </div>

                    <h3>
                      No events yet
                    </h3>

                    <p>
                      Create your first audio
                      guestbook event to get started.
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={openCreateEvent}
                    >
                      + Create Event
                    </button>

                  </div>
                )}


              {/* Events */}

              {!eventsLoading &&
                !eventsError &&
                events.length > 0 && (

                  <div className="event-grid">

                    {events
                      .slice(0, 3)
                      .map((event) => (

                        <div
                          className="event-card"
                          key={event.id}
                        >

                          <div className="event-image">

                            <div className="event-image-icon">
                              🎙
                            </div>

                          </div>


                          <div className="event-card-content">

                            <div className="event-type">
                              AUDIO GUESTBOOK
                            </div>

                            <h3>
                              {event.name}
                            </h3>

                            <div className="event-date">
                              {formatDate(
                                event.event_date
                              )}
                            </div>


                            {event.description && (
                              <p className="event-description">
                                {event.description}
                              </p>
                            )}


                            <div className="event-card-footer">

                              <span>
                                /{event.slug}
                              </span>

                              <button
                                type="button"
                                className="open-button"
                                onClick={() =>
                                  setPage('events')
                                }
                              >
                                Open →
                              </button>

                            </div>

                          </div>

                        </div>

                      ))}

                  </div>

                )}

            </section>


            {/* Recent Messages */}

            <section className="section">

              <div className="section-header">

                <div>

                  <h2>
                    Recent Messages
                  </h2>

                  <p>
                    Latest guestbook recordings
                  </p>

                </div>

              </div>


              <div className="empty-state compact">

                <div className="empty-icon">
                  ♫
                </div>

                <h3>
                  Audio messages will appear here
                </h3>

                <p>
                  We'll connect your recordings
                  in the next step.
                </p>

              </div>

            </section>

          </>

        )}


        {/* ====================================================
            EVENTS
        ==================================================== */}

        {page === 'events' && (

          <>

            <header className="page-header">

              <div>

                <h1>
                  Events
                </h1>

                <p>
                  Manage your audio guestbook events
                </p>

              </div>

              <button
                type="button"
                className="primary-button"
                onClick={openCreateEvent}
              >
                + Create Event
              </button>

            </header>


            <section className="section">

              <div className="section-header">

                <div>

                  <h2>
                    Your Events
                  </h2>

                  <p>
                    Events stored in Supabase
                  </p>

                </div>

              </div>


              {eventsLoading && (
                <div className="empty-state">
                  Loading events...
                </div>
              )}


              {eventsError && (
                <div className="login-error">

                  <strong>
                    Unable to load events
                  </strong>

                  <br />

                  {eventsError}

                </div>
              )}


              {!eventsLoading &&
                !eventsError &&
                events.length === 0 && (

                  <div className="empty-state">

                    <div className="empty-icon">
                      ◉
                    </div>

                    <h3>
                      No events found
                    </h3>

                    <p>
                      Create your first audio
                      guestbook event to get started.
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={openCreateEvent}
                    >
                      + Create Event
                    </button>

                  </div>

                )}


              {!eventsLoading &&
                !eventsError &&
                events.length > 0 && (

                  <div className="event-list">

                    {events.map((event) => (

                      <div
                        className="event-list-item"
                        key={event.id}
                      >

                        <div className="event-list-icon">
                          🎙
                        </div>


                        <div className="event-list-info">

                          <h3>
                            {event.name}
                          </h3>

                          <p>
                            {formatDate(
                              event.event_date
                            )}
                          </p>

                          <span>
                            /{event.slug}
                          </span>

                        </div>


                        <div className="event-list-actions">

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              alert(
                                `Event: ${event.name}`
                              )
                            }
                          >
                            Open
                          </button>

                        </div>

                      </div>

                    ))}

                  </div>

                )}

            </section>

          </>

        )}


        {/* ====================================================
            MESSAGES
        ==================================================== */}

        {page === 'messages' && (

          <>

            <header className="page-header">

              <div>

                <h1>
                  Messages
                </h1>

                <p>
                  Manage your guestbook recordings
                </p>

              </div>

            </header>


            <section className="section">

              <div className="empty-state">

                <div className="empty-icon">
                  ♫
                </div>

                <h3>
                  Messages coming next
                </h3>

                <p>
                  Your Supabase messages table is
                  ready. We'll connect the recordings
                  and Cloudflare R2 storage next.
                </p>

              </div>

            </section>

          </>

        )}


        {/* ====================================================
            SETTINGS
        ==================================================== */}

        {page === 'settings' && (

          <>

            <header className="page-header">

              <div>

                <h1>
                  Settings
                </h1>

                <p>
                  Manage your Audio Guestbook account
                </p>

              </div>

            </header>


            <section className="section">

              <div className="settings-card">

                <h2>
                  Account
                </h2>


                <div className="setting-row">

                  <div>

                    <strong>
                      Email
                    </strong>

                    <p>
                      Your administrator email
                    </p>

                  </div>

                  <span>
                    {user?.email}
                  </span>

                </div>


                <div className="setting-row">

                  <div>

                    <strong>
                      Authentication
                    </strong>

                    <p>
                      Supabase Authentication
                    </p>

                  </div>

                  <span className="status-badge">
                    Connected
                  </span>

                </div>


                <div className="setting-row">

                  <div>

                    <strong>
                      Database
                    </strong>

                    <p>
                      Supabase PostgreSQL
                    </p>

                  </div>

                  <span className="status-badge">
                    Connected
                  </span>

                </div>


                <div className="setting-row">

                  <div>

                    <strong>
                      Storage
                    </strong>

                    <p>
                      Cloudflare R2
                    </p>

                  </div>

                  <span className="status-badge">
                    Connected
                  </span>

                </div>

              </div>

            </section>

          </>

        )}

      </main>

    </div>
  )
}


// ============================================================
// DATE FORMATTER
// ============================================================

function formatDate(date) {
  if (!date) {
    return 'No date'
  }

  const parsedDate = new Date(
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

export default App