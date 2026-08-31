import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import JSZip from 'jszip'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Guestbook from './pages/Guestbook'
import './App.css'

const API_URL =
  import.meta.env.VITE_AUDIO_API_URL

function App() {
  const [user, setUser] =
    useState(null)

  const [
    checkingAuth,
    setCheckingAuth,
  ] = useState(true)

  const [page, setPage] =
    useState('dashboard')

  const [
    selectedEvent,
    setSelectedEvent,
  ] = useState(null)

  // ============================================================
  // EVENTS
  // ============================================================

  const [events, setEvents] =
    useState([])

  const [
    eventsLoading,
    setEventsLoading,
  ] = useState(false)

  const [
    eventsError,
    setEventsError,
  ] = useState('')

  const [
    showCreateEvent,
    setShowCreateEvent,
  ] = useState(false)

  const [
    creatingEvent,
    setCreatingEvent,
  ] = useState(false)

  const [
    createEventError,
    setCreateEventError,
  ] = useState('')

  const [
    newEvent,
    setNewEvent,
  ] = useState({
    name: '',
    event_date: '',
    description: '',
  })

  // ============================================================
  // EDIT EVENT
  // ============================================================

  const [
    showEditEvent,
    setShowEditEvent,
  ] = useState(false)

  const [
    editingEvent,
    setEditingEvent,
  ] = useState(false)

  const [
    editEventError,
    setEditEventError,
  ] = useState('')

  const [
    editEventForm,
    setEditEventForm,
  ] = useState({
    name: '',
    event_date: '',
    description: '',
  })

  const [
    deletingEvent,
    setDeletingEvent,
  ] = useState(false)

  // ============================================================
  // MESSAGES
  // ============================================================

  const [
    messages,
    setMessages,
  ] = useState([])

  const [
    messagesLoading,
    setMessagesLoading,
  ] = useState(false)

  const [
    messagesError,
    setMessagesError,
  ] = useState('')

  const [
    globalMessages,
    setGlobalMessages,
  ] = useState([])

  const [
    globalMessagesLoading,
    setGlobalMessagesLoading,
  ] = useState(false)

  const [
    globalMessagesError,
    setGlobalMessagesError,
  ] = useState('')

  // ============================================================
  // BULK MESSAGE SELECTION
  // ============================================================

  const [
    selectedMessageIds,
    setSelectedMessageIds,
  ] = useState([])

  const [
    bulkActionLoading,
    setBulkActionLoading,
  ] = useState(false)

  const [
    bulkActionText,
    setBulkActionText,
  ] = useState('')

  // ============================================================
  // MESSAGE FILTERS
  // ============================================================

  const [
    searchText,
    setSearchText,
  ] = useState('')

  const [
    eventFilter,
    setEventFilter,
  ] = useState('all')

  const [
    visibilityFilter,
    setVisibilityFilter,
  ] = useState('all')

  const [
    sortOrder,
    setSortOrder,
  ] = useState('newest')

  // ============================================================
  // UPLOAD
  // ============================================================

  const [
    uploading,
    setUploading,
  ] = useState(false)

  const [
    uploadStatus,
    setUploadStatus,
  ] = useState('')

  const [
    uploadError,
    setUploadError,
  ] = useState('')

  // ============================================================
  // AUDIO
  // ============================================================

  const [
    audioUrls,
    setAudioUrls,
  ] = useState({})

  const [
    audioLoadingId,
    setAudioLoadingId,
  ] = useState(null)

  const [
    downloadLoadingId,
    setDownloadLoadingId,
  ] = useState(null)

  const [
    downloadingAll,
    setDownloadingAll,
  ] = useState(false)

  // ============================================================
  // AUTH
  // ============================================================

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      setUser(
        session?.user || null
      )

      setCheckingAuth(false)
    }

    checkSession()

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(
            session?.user || null
          )

          setCheckingAuth(false)
        }
      )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ============================================================
  // LOAD EVENTS
  // ============================================================

  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user])

  // ============================================================
  // LOAD GLOBAL MESSAGES
  // ============================================================

  useEffect(() => {
    if (!user) {
      return
    }

    if (events.length > 0) {
      loadGlobalMessages()
    } else if (!eventsLoading) {
      setGlobalMessages([])
    }
  }, [
    user,
    events,
    eventsLoading,
  ])

  // ============================================================
  // LOAD EVENT MESSAGES
  // ============================================================

  useEffect(() => {
    if (
      page === 'event-details' &&
      selectedEvent
    ) {
      loadMessages(
        selectedEvent.id
      )
    }
  }, [
    page,
    selectedEvent,
  ])

  // ============================================================
  // PUBLIC GALLERY
  // ============================================================

  const guestbookMatch =
    window.location.pathname.match(
      /^\/guestbook\/([^/]+)\/?$/
    )

  if (guestbookMatch) {
    const slug =
      decodeURIComponent(
        guestbookMatch[1]
      )

    return (
      <Guestbook slug={slug} />
    )
  }

  // ============================================================
  // API FETCH
  // ============================================================

  async function apiFetch(
    path,
    options = {}
  ) {
    const {
      data: { session },
    } =
      await supabase.auth.getSession()

    if (!session) {
      throw new Error(
        'You are not logged in.'
      )
    }

    if (!API_URL) {
      throw new Error(
        'VITE_AUDIO_API_URL is not configured.'
      )
    }

    const headers = {
      ...(options.headers || {}),

      Authorization:
        `Bearer ${session.access_token}`,
    }

    return fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers,
      }
    )
  }

  // ============================================================
  // PAGE NAVIGATION
  // ============================================================

  function navigateTo(
    destination
  ) {
    setPage(destination)
    setSelectedEvent(null)
    clearBulkSelection()
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    await supabase.auth.signOut()

    clearAllAudioUrls()

    setUser(null)

    setPage(
      'dashboard'
    )

    setSelectedEvent(null)
    setMessages([])
    setGlobalMessages([])
    clearBulkSelection()
  }

  // ============================================================
  // LOAD EVENTS
  // ============================================================

  async function loadEvents() {
    setEventsLoading(true)
    setEventsError('')

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from('events')
          .select(
            'id,name,slug,event_date,description'
          )
          .order(
            'event_date',
            {
              ascending: false,
              nullsFirst: false,
            }
          )

      if (error) {
        throw error
      }

      setEvents(
        data || []
      )
    } catch (error) {
      console.error(
        'Load events error:',
        error
      )

      setEventsError(
        error.message ||
          'Unable to load events.'
      )
    } finally {
      setEventsLoading(false)
    }
  }

  // ============================================================
  // OPEN EVENT
  // ============================================================

  function openEvent(event) {
    clearBulkSelection()

    setSelectedEvent(event)

    setPage(
      'event-details'
    )

    setMessages([])
    setMessagesError('')
    setUploadStatus('')
    setUploadError('')
  }

  // ============================================================
  // CREATE EVENT
  // ============================================================

  function createSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
  }

  async function handleCreateEvent(
    event
  ) {
    event.preventDefault()

    setCreateEventError('')

    if (
      !newEvent.name.trim()
    ) {
      setCreateEventError(
        'Event name is required.'
      )

      return
    }

    setCreatingEvent(true)

    try {
      let slug =
        createSlug(
          newEvent.name
        )

      if (!slug) {
        slug =
          `event-${Date.now()}`
      }

      const {
        data:
          existingEvents,

        error:
          slugCheckError,
      } =
        await supabase
          .from('events')
          .select('id')
          .eq(
            'slug',
            slug
          )
          .limit(1)

      if (slugCheckError) {
        throw slugCheckError
      }

      if (
        existingEvents &&
        existingEvents.length >
          0
      ) {
        slug =
          `${slug}-${Date.now()}`
      }

      const {
        data,
        error,
      } =
        await supabase
          .from('events')
          .insert({
            name:
              newEvent.name.trim(),

            slug,

            event_date:
              newEvent.event_date ||
              null,

            description:
              newEvent.description.trim() ||
              null,
          })
          .select()
          .single()

      if (error) {
        throw error
      }

      setEvents(
        (current) => [
          data,
          ...current,
        ]
      )

      setNewEvent({
        name: '',
        event_date: '',
        description: '',
      })

      setShowCreateEvent(false)

      openEvent(data)
    } catch (error) {
      console.error(
        'Create event error:',
        error
      )

      setCreateEventError(
        error.message ||
          'Unable to create event.'
      )
    } finally {
      setCreatingEvent(false)
    }
  }

  // ============================================================
  // OPEN EDIT EVENT
  // ============================================================

  function openEditEvent() {
    if (!selectedEvent) {
      return
    }

    setEditEventForm({
      name:
        selectedEvent.name ||
        '',

      event_date:
        selectedEvent.event_date ||
        '',

      description:
        selectedEvent.description ||
        '',
    })

    setEditEventError('')

    setShowEditEvent(true)
  }

  // ============================================================
  // SAVE EDIT EVENT
  // ============================================================

  async function handleEditEvent(
    event
  ) {
    event.preventDefault()

    if (!selectedEvent) {
      return
    }

    setEditEventError('')

    if (
      !editEventForm.name.trim()
    ) {
      setEditEventError(
        'Event name is required.'
      )

      return
    }

    setEditingEvent(true)

    try {
      const response =
        await apiFetch(
          `/event/${selectedEvent.id}`,
          {
            method:
              'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                name:
                  editEventForm.name.trim(),

                event_date:
                  editEventForm.event_date ||
                  null,

                description:
                  editEventForm.description.trim() ||
                  null,
              }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to update event.'
        )
      }

      const updatedEvent = {
        ...selectedEvent,
        ...data.event,
      }

      setEvents(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              updatedEvent.id
                ? updatedEvent
                : item
          )
      )

      setSelectedEvent(
        updatedEvent
      )

      setGlobalMessages(
        (current) =>
          current.map(
            (message) =>
              message.event_id ===
              updatedEvent.id
                ? {
                    ...message,

                    event_name:
                      updatedEvent.name,

                    event_date:
                      updatedEvent.event_date,

                    event_slug:
                      updatedEvent.slug,
                  }
                : message
          )
      )

      setShowEditEvent(false)
    } catch (error) {
      console.error(
        'Edit event error:',
        error
      )

      setEditEventError(
        error.message ||
          'Unable to update event.'
      )
    } finally {
      setEditingEvent(false)
    }
  }

  // ============================================================
  // DELETE EVENT
  // ============================================================

  async function deleteEvent() {
    if (!selectedEvent) {
      return
    }

    const recordingCount =
      messages.length

    const recordingText =
      recordingCount > 0
        ? ` and all ${recordingCount} recording${
            recordingCount === 1
              ? ''
              : 's'
          }`
        : ''

    const confirmed =
      window.confirm(
        `Delete "${selectedEvent.name}"?\n\n` +
          `This will permanently delete this event${recordingText}.\n\n` +
          `This cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    setDeletingEvent(true)

    try {
      const response =
        await apiFetch(
          `/event/${selectedEvent.id}`,
          {
            method:
              'DELETE',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to delete event.'
        )
      }

      const deletedEventId =
        selectedEvent.id

      messages.forEach(
        (message) => {
          revokeAudioUrl(
            message.id
          )
        }
      )

      setEvents(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              deletedEventId
          )
      )

      setGlobalMessages(
        (current) =>
          current.filter(
            (message) =>
              message.event_id !==
              deletedEventId
          )
      )

      setMessages([])
      clearBulkSelection()

      setSelectedEvent(null)

      setPage(
        'events'
      )

      alert(
        'Event deleted successfully.'
      )
    } catch (error) {
      console.error(
        'Delete event error:',
        error
      )

      alert(
        error.message ||
          'Unable to delete event.'
      )
    } finally {
      setDeletingEvent(false)
    }
  }

  // ============================================================
  // LOAD EVENT MESSAGES
  // ============================================================

  async function loadMessages(
    eventId
  ) {
    setMessagesLoading(true)
    setMessagesError('')

    try {
      const response =
        await apiFetch(
          `/messages/${eventId}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to load messages.'
        )
      }

      setMessages(
        data || []
      )
    } catch (error) {
      console.error(
        'Load messages error:',
        error
      )

      setMessagesError(
        error.message
      )
    } finally {
      setMessagesLoading(false)
    }
  }

  // ============================================================
  // GLOBAL MESSAGES
  // ============================================================

  async function loadGlobalMessages() {
    setGlobalMessagesLoading(
      true
    )

    setGlobalMessagesError('')

    try {
      const results =
        await Promise.all(
          events.map(
            async (
              event
            ) => {
              const response =
                await apiFetch(
                  `/messages/${event.id}`
                )

              const data =
                await response.json()

              if (
                !response.ok
              ) {
                throw new Error(
                  data.error ||
                    `Unable to load recordings for ${event.name}.`
                )
              }

              return (
                data || []
              ).map(
                (
                  message
                ) => ({
                  ...message,

                  event_name:
                    event.name,

                  event_slug:
                    event.slug,

                  event_date:
                    event.event_date,
                })
              )
            }
          )
        )

      setGlobalMessages(
        results.flat()
      )
    } catch (error) {
      console.error(
        'Global messages error:',
        error
      )

      setGlobalMessagesError(
        error.message
      )
    } finally {
      setGlobalMessagesLoading(
        false
      )
    }
  }

  // ============================================================
  // FILTER GLOBAL MESSAGES
  // ============================================================

  const filteredGlobalMessages =
    useMemo(() => {
      let filtered = [
        ...globalMessages,
      ]

      const normalizedSearch =
        searchText
          .trim()
          .toLowerCase()

      if (normalizedSearch) {
        filtered =
          filtered.filter(
            (
              message
            ) => {
              const eventName =
                String(
                  message.event_name ||
                    ''
                ).toLowerCase()

              const fileName =
                String(
                  message.file_name ||
                    ''
                ).toLowerCase()

              const messageNumber =
                String(
                  message.message_number ||
                    ''
                )

              return (
                eventName.includes(
                  normalizedSearch
                ) ||
                fileName.includes(
                  normalizedSearch
                ) ||
                messageNumber.includes(
                  normalizedSearch
                )
              )
            }
          )
      }

      if (
        eventFilter !==
        'all'
      ) {
        filtered =
          filtered.filter(
            (
              message
            ) =>
              message.event_id ===
              eventFilter
          )
      }

      if (
        visibilityFilter ===
        'visible'
      ) {
        filtered =
          filtered.filter(
            (
              message
            ) =>
              message.is_visible
          )
      }

      if (
        visibilityFilter ===
        'hidden'
      ) {
        filtered =
          filtered.filter(
            (
              message
            ) =>
              !message.is_visible
          )
      }

      filtered.sort(
        (a, b) => {
          if (
            sortOrder ===
            'oldest'
          ) {
            return (
              new Date(
                a.created_at ||
                  0
              ) -
              new Date(
                b.created_at ||
                  0
              )
            )
          }

          if (
            sortOrder ===
            'event-name'
          ) {
            return String(
              a.event_name ||
                ''
            ).localeCompare(
              String(
                b.event_name ||
                  ''
              )
            )
          }

          if (
            sortOrder ===
            'message-number'
          ) {
            if (
              a.event_name ===
              b.event_name
            ) {
              return (
                Number(
                  a.message_number ||
                    0
                ) -
                Number(
                  b.message_number ||
                    0
                )
              )
            }

            return String(
              a.event_name ||
                ''
            ).localeCompare(
              String(
                b.event_name ||
                  ''
              )
            )
          }

          return (
            new Date(
              b.created_at ||
                0
            ) -
            new Date(
              a.created_at ||
                0
            )
          )
        }
      )

      return filtered
    }, [
      globalMessages,
      searchText,
      eventFilter,
      visibilityFilter,
      sortOrder,
    ])

  function clearMessageFilters() {
    setSearchText('')
    setEventFilter('all')

    setVisibilityFilter(
      'all'
    )

    setSortOrder(
      'newest'
    )

    clearBulkSelection()
  }

  const filtersActive =
    searchText.trim() !== '' ||
    eventFilter !== 'all' ||
    visibilityFilter !==
      'all' ||
    sortOrder !== 'newest'

  // ============================================================
  // BULK SELECTION
  // ============================================================

  function clearBulkSelection() {
    setSelectedMessageIds(
      []
    )
  }

  function toggleMessageSelection(
    messageId
  ) {
    setSelectedMessageIds(
      (current) => {
        if (
          current.includes(
            messageId
          )
        ) {
          return current.filter(
            (id) =>
              id !==
              messageId
          )
        }

        return [
          ...current,
          messageId,
        ]
      }
    )
  }

  function selectAllMessages(
    list
  ) {
    const ids =
      list.map(
        (message) =>
          message.id
      )

    setSelectedMessageIds(
      ids
    )
  }

  function toggleSelectAll(
    list
  ) {
    const ids =
      list.map(
        (message) =>
          message.id
      )

    const allSelected =
      ids.length > 0 &&
      ids.every(
        (id) =>
          selectedMessageIds.includes(
            id
          )
      )

    if (allSelected) {
      clearBulkSelection()
    } else {
      selectAllMessages(
        list
      )
    }
  }

  function getSelectedMessages(
    list
  ) {
    return list.filter(
      (message) =>
        selectedMessageIds.includes(
          message.id
        )
    )
  }

  function updateMessageEverywhere(
    updatedMessage
  ) {
    setMessages(
      (current) =>
        current.map(
          (message) =>
            message.id ===
            updatedMessage.id
              ? {
                  ...message,
                  ...updatedMessage,
                }
              : message
        )
    )

    setGlobalMessages(
      (current) =>
        current.map(
          (message) =>
            message.id ===
            updatedMessage.id
              ? {
                  ...message,
                  ...updatedMessage,
                }
              : message
        )
    )
  }

  // ============================================================
  // BULK SHOW / HIDE
  // ============================================================

  async function bulkSetVisibility(
    list,
    isVisible
  ) {
    const selected =
      getSelectedMessages(
        list
      )

    if (
      selected.length === 0
    ) {
      return
    }

    setBulkActionLoading(
      true
    )

    setBulkActionText(
      isVisible
        ? 'Showing recordings...'
        : 'Hiding recordings...'
    )

    try {
      let completed = 0

      for (
        const message
        of selected
      ) {
        setBulkActionText(
          `${
            isVisible
              ? 'Showing'
              : 'Hiding'
          } ${completed + 1} of ${
            selected.length
          }...`
        )

        const response =
          await apiFetch(
            `/visibility/${message.id}`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  is_visible:
                    isVisible,
                }),
            }
          )

        const data =
          await response.json()

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              `Unable to update Message ${message.message_number}.`
          )
        }

        updateMessageEverywhere(
          data.message
        )

        completed++
      }

      clearBulkSelection()
    } catch (error) {
      console.error(
        'Bulk visibility error:',
        error
      )

      alert(
        error.message
      )
    } finally {
      setBulkActionText('')
      setBulkActionLoading(
        false
      )
    }
  }

  // ============================================================
  // BULK DELETE
  // ============================================================

  async function bulkDeleteMessages(
    list
  ) {
    const selected =
      getSelectedMessages(
        list
      )

    if (
      selected.length === 0
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Permanently delete ${selected.length} selected recording${
          selected.length === 1
            ? ''
            : 's'
        }?\n\n` +
          `The audio files will be removed from Cloudflare R2 and the database.\n\n` +
          `This cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    setBulkActionLoading(
      true
    )

    let deletedCount = 0

    try {
      for (
        const message
        of selected
      ) {
        setBulkActionText(
          `Deleting ${
            deletedCount + 1
          } of ${
            selected.length
          }...`
        )

        const response =
          await apiFetch(
            `/message/${message.id}`,
            {
              method:
                'DELETE',
            }
          )

        const data =
          await response.json()

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              `Unable to delete Message ${message.message_number}.`
          )
        }

        revokeAudioUrl(
          message.id
        )

        setMessages(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                message.id
            )
        )

        setGlobalMessages(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                message.id
            )
        )

        setSelectedMessageIds(
          (current) =>
            current.filter(
              (id) =>
                id !==
                message.id
            )
        )

        deletedCount++
      }

      clearBulkSelection()

      alert(
        `${deletedCount} recording${
          deletedCount === 1
            ? ''
            : 's'
        } deleted successfully.`
      )
    } catch (error) {
      console.error(
        'Bulk delete error:',
        error
      )

      alert(
        `${deletedCount} recording${
          deletedCount === 1
            ? ''
            : 's'
        } deleted before an error occurred.\n\n${
          error.message
        }`
      )
    } finally {
      setBulkActionText('')
      setBulkActionLoading(
        false
      )
    }
  }

  // ============================================================
  // BULK DOWNLOAD ZIP
  // ============================================================

  async function bulkDownloadMessages(
    list,
    includeEventFolders =
      false
  ) {
    const selected =
      getSelectedMessages(
        list
      )

    if (
      selected.length === 0
    ) {
      return
    }

    setBulkActionLoading(
      true
    )

    try {
      const zip =
        new JSZip()

      for (
        let index = 0;
        index <
        selected.length;
        index++
      ) {
        const message =
          selected[index]

        setBulkActionText(
          `Downloading ${
            index + 1
          } of ${
            selected.length
          }...`
        )

        const response =
          await apiFetch(
            `/audio/${message.id}?download=1`
          )

        if (
          !response.ok
        ) {
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

        const fileName =
          `Message-${String(
            message.message_number
          ).padStart(
            3,
            '0'
          )}${extension}`

        if (
          includeEventFolders
        ) {
          const folderName =
            sanitizeFileName(
              message.event_name ||
                'Event'
            )

          zip
            .folder(
              folderName
            )
            .file(
              fileName,
              blob
            )
        } else {
          zip.file(
            fileName,
            blob
          )
        }
      }

      setBulkActionText(
        'Creating ZIP...'
      )

      const zipBlob =
        await zip.generateAsync(
          {
            type:
              'blob',
          }
        )

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

      if (
        selectedEvent &&
        !includeEventFolders
      ) {
        link.download =
          `${selectedEvent.slug}-selected-recordings.zip`
      } else {
        link.download =
          'selected-audio-guestbook-recordings.zip'
      }

      document.body.appendChild(
        link
      )

      link.click()
      link.remove()

      URL.revokeObjectURL(
        objectUrl
      )

      clearBulkSelection()
    } catch (error) {
      console.error(
        'Bulk download error:',
        error
      )

      alert(
        error.message
      )
    } finally {
      setBulkActionText('')
      setBulkActionLoading(
        false
      )
    }
  }

  // ============================================================
  // AUDIO DURATION
  // ============================================================

  function getAudioDuration(
    file
  ) {
    return new Promise(
      (resolve) => {
        const audio =
          document.createElement(
            'audio'
          )

        const objectUrl =
          URL.createObjectURL(
            file
          )

        audio.preload =
          'metadata'

        audio.onloadedmetadata =
          () => {
            const duration =
              Number.isFinite(
                audio.duration
              )
                ? audio.duration
                : 0

            URL.revokeObjectURL(
              objectUrl
            )

            resolve(
              duration
            )
          }

        audio.onerror =
          () => {
            URL.revokeObjectURL(
              objectUrl
            )

            resolve(0)
          }

        audio.src =
          objectUrl
      }
    )
  }

  // ============================================================
  // UPLOAD
  // ============================================================

  async function handleAudioUpload(
    event
  ) {
    const files =
      Array.from(
        event.target.files ||
          []
      )

    event.target.value =
      ''

    if (
      files.length === 0 ||
      !selectedEvent
    ) {
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadStatus('')

    try {
      let uploadedCount =
        0

      for (
        let index = 0;
        index <
        files.length;
        index++
      ) {
        const file =
          files[index]

        setUploadStatus(
          `Uploading ${
            index + 1
          } of ${
            files.length
          }: ${file.name}`
        )

        const duration =
          await getAudioDuration(
            file
          )

        const response =
          await apiFetch(
            `/upload/${selectedEvent.id}`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  file.type ||
                  'application/octet-stream',

                'X-File-Name':
                  encodeURIComponent(
                    file.name
                  ),

                'X-File-Size':
                  String(
                    file.size
                  ),

                'X-Duration':
                  String(
                    duration
                  ),
              },

              body:
                file,
            }
          )

        const data =
          await response.json()

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              `Unable to upload ${file.name}.`
          )
        }

        uploadedCount++
      }

      await loadMessages(
        selectedEvent.id
      )

      await loadGlobalMessages()

      setUploadStatus(
        `${uploadedCount} ${
          uploadedCount === 1
            ? 'recording'
            : 'recordings'
        } uploaded successfully.`
      )
    } catch (error) {
      console.error(
        'Upload error:',
        error
      )

      setUploadError(
        error.message
      )
    } finally {
      setUploading(false)
    }
  }

  // ============================================================
  // PLAY MESSAGE
  // ============================================================

  async function playMessage(
    message
  ) {
    if (
      audioUrls[
        message.id
      ]
    ) {
      const audio =
        document.getElementById(
          `admin-audio-${message.id}`
        )

      if (audio) {
        audio.play()
      }

      return
    }

    setAudioLoadingId(
      message.id
    )

    try {
      const response =
        await apiFetch(
          `/audio/${message.id}`
        )

      if (
        !response.ok
      ) {
        throw new Error(
          'Unable to load audio.'
        )
      }

      const blob =
        await response.blob()

      const objectUrl =
        URL.createObjectURL(
          blob
        )

      setAudioUrls(
        (current) => ({
          ...current,

          [message.id]:
            objectUrl,
        })
      )

      setTimeout(
        () => {
          const audio =
            document.getElementById(
              `admin-audio-${message.id}`
            )

          if (audio) {
            audio.play()
          }
        },
        50
      )
    } catch (error) {
      alert(
        error.message
      )
    } finally {
      setAudioLoadingId(
        null
      )
    }
  }

  // ============================================================
  // DOWNLOAD SINGLE MESSAGE
  // ============================================================

  async function downloadMessage(
    message
  ) {
    setDownloadLoadingId(
      message.id
    )

    try {
      const response =
        await apiFetch(
          `/audio/${message.id}?download=1`
        )

      if (
        !response.ok
      ) {
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
    } finally {
      setDownloadLoadingId(
        null
      )
    }
  }

  // ============================================================
  // DOWNLOAD ALL EVENT RECORDINGS
  // ============================================================

  async function downloadAllMessages() {
    if (!selectedEvent) {
      return
    }

    const visibleRecordings =
      messages.filter(
        (message) =>
          message.is_visible
      )

    if (
      visibleRecordings.length ===
      0
    ) {
      alert(
        'There are no visible recordings to download.'
      )

      return
    }

    setDownloadingAll(true)

    try {
      const zip =
        new JSZip()

      for (
        const message
        of visibleRecordings
      ) {
        const response =
          await apiFetch(
            `/audio/${message.id}?download=1`
          )

        if (
          !response.ok
        ) {
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
        await zip.generateAsync(
          {
            type:
              'blob',
          }
        )

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
        `${selectedEvent.slug}-audio-guestbook.zip`

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
    } finally {
      setDownloadingAll(
        false
      )
    }
  }

  // ============================================================
  // SINGLE VISIBILITY
  // ============================================================

  async function toggleMessageVisibility(
    message
  ) {
    try {
      const response =
        await apiFetch(
          `/visibility/${message.id}`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                is_visible:
                  !message.is_visible,
              }),
          }
        )

      const data =
        await response.json()

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            'Unable to update message visibility.'
        )
      }

      updateMessageEverywhere(
        data.message
      )
    } catch (error) {
      console.error(
        'Visibility error:',
        error
      )

      alert(
        error.message
      )
    }
  }

  // ============================================================
  // DELETE SINGLE MESSAGE
  // ============================================================

  async function deleteMessage(
    message
  ) {
    const confirmed =
      window.confirm(
        `Delete Message ${message.message_number}?\n\n` +
          `This permanently removes the audio file from R2 and the database.\n\n` +
          `This cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    try {
      const response =
        await apiFetch(
          `/message/${message.id}`,
          {
            method:
              'DELETE',
          }
        )

      const data =
        await response.json()

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            'Unable to delete message.'
        )
      }

      revokeAudioUrl(
        message.id
      )

      setMessages(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              message.id
          )
      )

      setGlobalMessages(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              message.id
          )
      )

      setSelectedMessageIds(
        (current) =>
          current.filter(
            (id) =>
              id !==
              message.id
          )
      )
    } catch (error) {
      console.error(
        'Delete error:',
        error
      )

      alert(
        error.message
      )
    }
  }

  // ============================================================
  // AUDIO URL CLEANUP
  // ============================================================

  function revokeAudioUrl(
    messageId
  ) {
    setAudioUrls(
      (current) => {
        const objectUrl =
          current[
            messageId
          ]

        if (objectUrl) {
          URL.revokeObjectURL(
            objectUrl
          )
        }

        const updated = {
          ...current,
        }

        delete updated[
          messageId
        ]

        return updated
      }
    )
  }

  function clearAllAudioUrls() {
    Object.values(
      audioUrls
    ).forEach(
      (objectUrl) => {
        URL.revokeObjectURL(
          objectUrl
        )
      }
    )

    setAudioUrls({})
  }

  // ============================================================
  // CLIENT GALLERY
  // ============================================================

  function getClientGalleryUrl() {
    if (!selectedEvent) {
      return ''
    }

    return (
      `${window.location.origin}` +
      `/guestbook/${selectedEvent.slug}`
    )
  }

  async function copyClientLink() {
    const link =
      getClientGalleryUrl()

    try {
      await navigator.clipboard.writeText(
        link
      )

      alert(
        'Client gallery link copied.'
      )
    } catch {
      window.prompt(
        'Copy client gallery link:',
        link
      )
    }
  }

  function openClientGallery() {
    window.open(
      getClientGalleryUrl(),
      '_blank',
      'noopener,noreferrer'
    )
  }

  // ============================================================
  // EVENT TOTALS
  // ============================================================

  const totalAudioMessages =
    messages.length

  const visibleMessages =
    messages.filter(
      (message) =>
        message.is_visible
    ).length

  const hiddenMessages =
    totalAudioMessages -
    visibleMessages

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

  const totalStorage =
    messages.reduce(
      (
        total,
        message
      ) =>
        total +
        Number(
          message.file_size ||
            0
        ),
      0
    )

  // ============================================================
  // GLOBAL TOTALS
  // ============================================================

  const globalVisibleMessages =
    globalMessages.filter(
      (message) =>
        message.is_visible
    ).length

  const globalDuration =
    globalMessages.reduce(
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

  const globalStorage =
    globalMessages.reduce(
      (
        total,
        message
      ) =>
        total +
        Number(
          message.file_size ||
            0
        ),
      0
    )

  // ============================================================
  // AUTH SCREEN
  // ============================================================

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app-shell">

      {/* ======================================================
          SIDEBAR
      ======================================================= */}

      <aside className="sidebar">

        <div className="sidebar-brand">

          <div className="brand-icon">
            🎙
          </div>

          <div>
            <strong>
              Audio Guestbook
            </strong>

            <small>
              Client Portal
            </small>
          </div>

        </div>

        <nav className="sidebar-nav">

          <button
            type="button"

            className={
              page ===
              'dashboard'
                ? 'active'
                : ''
            }

            onClick={() =>
              navigateTo(
                'dashboard'
              )
            }
          >
            <span>▦</span>

            Dashboard
          </button>

          <button
            type="button"

            className={
              page ===
                'events' ||
              page ===
                'event-details'
                ? 'active'
                : ''
            }

            onClick={() =>
              navigateTo(
                'events'
              )
            }
          >
            <span>◉</span>

            Events
          </button>

          <button
            type="button"

            className={
              page ===
              'messages'
                ? 'active'
                : ''
            }

            onClick={() =>
              navigateTo(
                'messages'
              )
            }
          >
            <span>♫</span>

            Messages
          </button>

          <button
            type="button"

            className={
              page ===
              'settings'
                ? 'active'
                : ''
            }

            onClick={() =>
              navigateTo(
                'settings'
              )
            }
          >
            <span>⚙</span>

            Settings
          </button>

        </nav>

        <div className="sidebar-footer">

          <div className="sidebar-user">

            <small>
              Signed in as
            </small>

            <span>
              {user.email}
            </span>

          </div>

          <button
            type="button"
            onClick={
              handleLogout
            }
          >
            Log Out
          </button>

        </div>

      </aside>

      {/* ======================================================
          MAIN CONTENT
      ======================================================= */}

      <main className="main-content">

        {/* ====================================================
            DASHBOARD
        ===================================================== */}

        {page ===
          'dashboard' && (
          <>

            <div className="page-header">

              <div>

                <p className="eyebrow">
                  OVERVIEW
                </p>

                <h1>
                  Dashboard
                </h1>

                <p>
                  Manage your audio guestbook events and client recordings.
                </p>

              </div>

              <button
                type="button"
                className="primary-button"

                onClick={() => {
                  setCreateEventError(
                    ''
                  )

                  setShowCreateEvent(
                    true
                  )
                }}
              >
                + Create Event
              </button>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <span>
                  Active Events
                </span>

                <strong>
                  {events.length}
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Total Messages
                </span>

                <strong>
                  {globalMessagesLoading
                    ? '...'
                    : globalMessages.length}
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Total Audio
                </span>

                <strong>
                  {globalMessagesLoading
                    ? '...'
                    : formatDuration(
                        globalDuration
                      )}
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Storage Used
                </span>

                <strong>
                  {globalMessagesLoading
                    ? '...'
                    : formatFileSize(
                        globalStorage
                      )}
                </strong>

              </div>

            </div>

            {globalMessagesError && (
              <div className="error-message">
                Unable to calculate recording statistics:{' '}
                {
                  globalMessagesError
                }
              </div>
            )}

            <section className="content-card">

              <div className="section-header">

                <div>

                  <h2>
                    Recent Events
                  </h2>

                  <p>
                    Open an event to manage its recordings.
                  </p>

                </div>

              </div>

              <EventList
                events={
                  events
                }

                loading={
                  eventsLoading
                }

                error={
                  eventsError
                }

                onOpen={
                  openEvent
                }
              />

            </section>

          </>
        )}

        {/* ====================================================
            EVENTS
        ===================================================== */}

        {page ===
          'events' && (
          <>

            <div className="page-header">

              <div>

                <p className="eyebrow">
                  EVENTS
                </p>

                <h1>
                  Events
                </h1>

                <p>
                  Manage all audio guestbook events.
                </p>

              </div>

              <button
                type="button"

                className="primary-button"

                onClick={() => {
                  setCreateEventError(
                    ''
                  )

                  setShowCreateEvent(
                    true
                  )
                }}
              >
                + Create Event
              </button>

            </div>

            <section className="content-card">

              <EventList
                events={
                  events
                }

                loading={
                  eventsLoading
                }

                error={
                  eventsError
                }

                onOpen={
                  openEvent
                }
              />

            </section>

          </>
        )}

        {/* ====================================================
            EVENT DETAILS
        ===================================================== */}

        {page ===
          'event-details' &&
          selectedEvent && (
          <>

            <button
              type="button"

              className="back-button"

              onClick={() => {
                setPage(
                  'events'
                )

                setSelectedEvent(
                  null
                )

                clearBulkSelection()
              }}
            >
              ← Back to Events
            </button>

            <div className="page-header">

              <div>

                <p className="eyebrow">
                  EVENT
                </p>

                <h1>
                  {
                    selectedEvent.name
                  }
                </h1>

                {selectedEvent.event_date && (
                  <p>
                    {formatDate(
                      selectedEvent.event_date
                    )}
                  </p>
                )}

                {selectedEvent.description && (
                  <p>
                    {
                      selectedEvent.description
                    }
                  </p>
                )}

              </div>

              <div className="gallery-actions">

                <button
                  type="button"
                  onClick={
                    openEditEvent
                  }
                >
                  ✎ Edit Event
                </button>

                <button
                  type="button"

                  className="danger-button"

                  disabled={
                    deletingEvent
                  }

                  onClick={
                    deleteEvent
                  }
                >
                  {deletingEvent
                    ? 'Deleting...'
                    : '🗑 Delete Event'}
                </button>

              </div>

            </div>

            {/* CLIENT GALLERY */}

            <section className="content-card">

              <div className="section-header">

                <div>

                  <h2>
                    Client Gallery
                  </h2>

                  <p>
                    Share this link with your client.
                  </p>

                </div>

              </div>

              <div className="client-gallery-box">

                <code>
                  {getClientGalleryUrl()}
                </code>

                <div className="gallery-actions">

                  <button
                    type="button"
                    onClick={
                      copyClientLink
                    }
                  >
                    📋 Copy Link
                  </button>

                  <button
                    type="button"
                    onClick={
                      openClientGallery
                    }
                  >
                    ↗ Open Gallery
                  </button>

                  <button
                    type="button"

                    disabled={
                      downloadingAll ||
                      visibleMessages ===
                        0
                    }

                    onClick={
                      downloadAllMessages
                    }
                  >
                    {downloadingAll
                      ? 'Preparing ZIP...'
                      : '↓ Download All'}
                  </button>

                </div>

              </div>

            </section>

            {/* EVENT STATS */}

            <div className="stats-grid">

              <div className="stat-card">

                <span>
                  Recordings
                </span>

                <strong>
                  {
                    totalAudioMessages
                  }
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Visible
                </span>

                <strong>
                  {
                    visibleMessages
                  }
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Total Audio
                </span>

                <strong>
                  {formatDuration(
                    totalDuration
                  )}
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Storage
                </span>

                <strong>
                  {formatFileSize(
                    totalStorage
                  )}
                </strong>

              </div>

            </div>

            {/* UPLOAD */}

            <section className="content-card">

              <div className="section-header">

                <div>

                  <h2>
                    Upload Audio
                  </h2>

                  <p>
                    Add recordings already captured by your audio guestbook.
                  </p>

                </div>

              </div>

              <label className="upload-box">

                <input
                  type="file"

                  multiple

                  accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*"

                  disabled={
                    uploading
                  }

                  onChange={
                    handleAudioUpload
                  }
                />

                <strong>
                  {uploading
                    ? 'Uploading...'
                    : 'Choose Audio Files'}
                </strong>

                <span>
                  MP3, WAV, M4A, AAC or OGG
                </span>

              </label>

              {uploadStatus && (
                <div className="success-message">
                  {
                    uploadStatus
                  }
                </div>
              )}

              {uploadError && (
                <div className="error-message">
                  {
                    uploadError
                  }
                </div>
              )}

            </section>

            {/* EVENT RECORDINGS */}

            <section className="content-card">

              <div className="section-header">

                <div>

                  <h2>
                    Guest Recordings
                  </h2>

                  <p>
                    {
                      totalAudioMessages
                    }{' '}
                    recordings ·{' '}
                    {
                      visibleMessages
                    }{' '}
                    visible

                    {hiddenMessages >
                      0 &&
                      ` · ${hiddenMessages} hidden`}
                  </p>

                </div>

              </div>

              {messages.length >
                0 && (
                <BulkActionBar
                  list={
                    messages
                  }

                  selectedMessageIds={
                    selectedMessageIds
                  }

                  loading={
                    bulkActionLoading
                  }

                  statusText={
                    bulkActionText
                  }

                  onToggleSelectAll={() =>
                    toggleSelectAll(
                      messages
                    )
                  }

                  onClear={
                    clearBulkSelection
                  }

                  onShow={() =>
                    bulkSetVisibility(
                      messages,
                      true
                    )
                  }

                  onHide={() =>
                    bulkSetVisibility(
                      messages,
                      false
                    )
                  }

                  onDownload={() =>
                    bulkDownloadMessages(
                      messages,
                      false
                    )
                  }

                  onDelete={() =>
                    bulkDeleteMessages(
                      messages
                    )
                  }
                />
              )}

              {messagesLoading && (
                <p>
                  Loading recordings...
                </p>
              )}

              {messagesError && (
                <div className="error-message">
                  {
                    messagesError
                  }
                </div>
              )}

              {!messagesLoading &&
                !messagesError &&
                messages.length ===
                  0 && (
                  <div className="empty-state">

                    <h3>
                      No recordings yet
                    </h3>

                    <p>
                      Upload your first guestbook recording above.
                    </p>

                  </div>
                )}

              <MessageList
                messages={
                  messages
                }

                selectedMessageIds={
                  selectedMessageIds
                }

                onToggleSelection={
                  toggleMessageSelection
                }

                audioUrls={
                  audioUrls
                }

                audioLoadingId={
                  audioLoadingId
                }

                downloadLoadingId={
                  downloadLoadingId
                }

                onPlay={
                  playMessage
                }

                onDownload={
                  downloadMessage
                }

                onVisibility={
                  toggleMessageVisibility
                }

                onDelete={
                  deleteMessage
                }
              />

            </section>

          </>
        )}

        {/* ====================================================
            GLOBAL MESSAGES
        ===================================================== */}

        {page ===
          'messages' && (
          <>

            <div className="page-header">

              <div>

                <p className="eyebrow">
                  MESSAGES
                </p>

                <h1>
                  All Messages
                </h1>

                <p>
                  Search and manage recordings from every event.
                </p>

              </div>

              <button
                type="button"

                onClick={() => {
                  clearBulkSelection()

                  loadGlobalMessages()
                }}

                disabled={
                  globalMessagesLoading
                }
              >
                {globalMessagesLoading
                  ? 'Refreshing...'
                  : '↻ Refresh'}
              </button>

            </div>

            {/* GLOBAL STATS */}

            <div className="stats-grid">

              <div className="stat-card">

                <span>
                  Total Messages
                </span>

                <strong>
                  {
                    globalMessages.length
                  }
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Visible
                </span>

                <strong>
                  {
                    globalVisibleMessages
                  }
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Total Audio
                </span>

                <strong>
                  {formatDuration(
                    globalDuration
                  )}
                </strong>

              </div>

              <div className="stat-card">

                <span>
                  Storage
                </span>

                <strong>
                  {formatFileSize(
                    globalStorage
                  )}
                </strong>

              </div>

            </div>

            <section className="content-card">

              <div className="section-header">

                <div>

                  <h2>
                    Recording Library
                  </h2>

                  <p>
                    Showing{' '}
                    {
                      filteredGlobalMessages.length
                    }{' '}
                    of{' '}
                    {
                      globalMessages.length
                    }{' '}
                    recordings
                  </p>

                </div>

              </div>

              {/* FILTERS */}

              <div className="message-filters">

                <div className="message-filter-field message-search-field">

                  <label htmlFor="message-search">
                    Search
                  </label>

                  <input
                    id="message-search"

                    type="search"

                    value={
                      searchText
                    }

                    onChange={(
                      event
                    ) => {
                      setSearchText(
                        event.target.value
                      )

                      clearBulkSelection()
                    }}

                    placeholder="Event, filename or message number"
                  />

                </div>

                <div className="message-filter-field">

                  <label htmlFor="event-filter">
                    Event
                  </label>

                  <select
                    id="event-filter"

                    value={
                      eventFilter
                    }

                    onChange={(
                      event
                    ) => {
                      setEventFilter(
                        event.target.value
                      )

                      clearBulkSelection()
                    }}
                  >

                    <option value="all">
                      All Events
                    </option>

                    {events.map(
                      (event) => (
                        <option
                          key={
                            event.id
                          }

                          value={
                            event.id
                          }
                        >
                          {
                            event.name
                          }
                        </option>
                      )
                    )}

                  </select>

                </div>

                <div className="message-filter-field">

                  <label htmlFor="visibility-filter">
                    Visibility
                  </label>

                  <select
                    id="visibility-filter"

                    value={
                      visibilityFilter
                    }

                    onChange={(
                      event
                    ) => {
                      setVisibilityFilter(
                        event.target.value
                      )

                      clearBulkSelection()
                    }}
                  >

                    <option value="all">
                      All Messages
                    </option>

                    <option value="visible">
                      Visible
                    </option>

                    <option value="hidden">
                      Hidden
                    </option>

                  </select>

                </div>

                <div className="message-filter-field">

                  <label htmlFor="sort-order">
                    Sort
                  </label>

                  <select
                    id="sort-order"

                    value={
                      sortOrder
                    }

                    onChange={(
                      event
                    ) => {
                      setSortOrder(
                        event.target.value
                      )

                      clearBulkSelection()
                    }}
                  >

                    <option value="newest">
                      Newest First
                    </option>

                    <option value="oldest">
                      Oldest First
                    </option>

                    <option value="event-name">
                      Event Name
                    </option>

                    <option value="message-number">
                      Message Number
                    </option>

                  </select>

                </div>

                <div className="message-filter-clear">

                  <button
                    type="button"

                    onClick={
                      clearMessageFilters
                    }

                    disabled={
                      !filtersActive
                    }
                  >
                    Clear Filters
                  </button>

                </div>

              </div>

              {/* BULK TOOLBAR */}

              {filteredGlobalMessages.length >
                0 && (
                <BulkActionBar
                  list={
                    filteredGlobalMessages
                  }

                  selectedMessageIds={
                    selectedMessageIds
                  }

                  loading={
                    bulkActionLoading
                  }

                  statusText={
                    bulkActionText
                  }

                  onToggleSelectAll={() =>
                    toggleSelectAll(
                      filteredGlobalMessages
                    )
                  }

                  onClear={
                    clearBulkSelection
                  }

                  onShow={() =>
                    bulkSetVisibility(
                      filteredGlobalMessages,
                      true
                    )
                  }

                  onHide={() =>
                    bulkSetVisibility(
                      filteredGlobalMessages,
                      false
                    )
                  }

                  onDownload={() =>
                    bulkDownloadMessages(
                      filteredGlobalMessages,
                      true
                    )
                  }

                  onDelete={() =>
                    bulkDeleteMessages(
                      filteredGlobalMessages
                    )
                  }
                />
              )}

              {globalMessagesLoading && (
                <p>
                  Loading recordings from all events...
                </p>
              )}

              {globalMessagesError && (
                <div className="error-message">
                  {
                    globalMessagesError
                  }
                </div>
              )}

              {!globalMessagesLoading &&
                !globalMessagesError &&
                globalMessages.length ===
                  0 && (
                  <div className="empty-state">

                    <h3>
                      No recordings found
                    </h3>

                    <p>
                      Upload recordings to an event and they will appear here.
                    </p>

                  </div>
                )}

              {!globalMessagesLoading &&
                !globalMessagesError &&
                globalMessages.length >
                  0 &&
                filteredGlobalMessages.length ===
                  0 && (
                  <div className="empty-state">

                    <h3>
                      No matching recordings
                    </h3>

                    <p>
                      Try changing your search or filters.
                    </p>

                    <button
                      type="button"
                      onClick={
                        clearMessageFilters
                      }
                    >
                      Clear Filters
                    </button>

                  </div>
                )}

              <MessageList
                messages={
                  filteredGlobalMessages
                }

                showEventName

                selectedMessageIds={
                  selectedMessageIds
                }

                onToggleSelection={
                  toggleMessageSelection
                }

                audioUrls={
                  audioUrls
                }

                audioLoadingId={
                  audioLoadingId
                }

                downloadLoadingId={
                  downloadLoadingId
                }

                onPlay={
                  playMessage
                }

                onDownload={
                  downloadMessage
                }

                onVisibility={
                  toggleMessageVisibility
                }

                onDelete={
                  deleteMessage
                }

                onOpenEvent={(
                  message
                ) => {
                  const event =
                    events.find(
                      (item) =>
                        item.id ===
                        message.event_id
                    )

                  if (event) {
                    openEvent(
                      event
                    )
                  }
                }}
              />

            </section>

          </>
        )}

        {/* ====================================================
            SETTINGS
        ===================================================== */}

        {page ===
          'settings' && (
          <>

            <div className="page-header">

              <div>

                <p className="eyebrow">
                  SETTINGS
                </p>

                <h1>
                  Settings
                </h1>

              </div>

            </div>

            <section className="content-card">

              <h2>
                System Status
              </h2>

              <div className="settings-list">

                <div>

                  <span>
                    Supabase Auth
                  </span>

                  <strong>
                    Connected
                  </strong>

                </div>

                <div>

                  <span>
                    Supabase Database
                  </span>

                  <strong>
                    Connected
                  </strong>

                </div>

                <div>

                  <span>
                    Cloudflare R2
                  </span>

                  <strong>
                    Connected
                  </strong>

                </div>

                <div>

                  <span>
                    Audio API
                  </span>

                  <strong>
                    {API_URL
                      ? 'Configured'
                      : 'Missing'}
                  </strong>

                </div>

              </div>

            </section>

          </>
        )}

      </main>

      {/* ========================================================
          CREATE EVENT MODAL
      ======================================================== */}

      {showCreateEvent && (
        <div
          className="modal-backdrop"

          onMouseDown={() =>
            setShowCreateEvent(
              false
            )
          }
        >

          <div
            className="modal"

            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <p className="eyebrow">
                  NEW EVENT
                </p>

                <h2>
                  Create Event
                </h2>

              </div>

              <button
                type="button"

                onClick={() =>
                  setShowCreateEvent(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleCreateEvent
              }
            >

              <label>

                Event Name *

                <input
                  type="text"

                  value={
                    newEvent.name
                  }

                  onChange={(
                    event
                  ) =>
                    setNewEvent(
                      (
                        current
                      ) => ({
                        ...current,

                        name:
                          event
                            .target
                            .value,
                      })
                    )
                  }

                  placeholder="Billy & Sarah Wedding"

                  autoFocus
                />

              </label>

              <label>

                Event Date

                <input
                  type="date"

                  value={
                    newEvent.event_date
                  }

                  onChange={(
                    event
                  ) =>
                    setNewEvent(
                      (
                        current
                      ) => ({
                        ...current,

                        event_date:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                />

              </label>

              <label>

                Description

                <textarea
                  value={
                    newEvent.description
                  }

                  onChange={(
                    event
                  ) =>
                    setNewEvent(
                      (
                        current
                      ) => ({
                        ...current,

                        description:
                          event
                            .target
                            .value,
                      })
                    )
                  }

                  placeholder="Optional event description"

                  rows="4"
                />

              </label>

              {createEventError && (
                <div className="error-message">
                  {
                    createEventError
                  }
                </div>
              )}

              <div className="modal-actions">

                <button
                  type="button"

                  onClick={() =>
                    setShowCreateEvent(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"

                  className="primary-button"

                  disabled={
                    creatingEvent
                  }
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

      {/* ========================================================
          EDIT EVENT MODAL
      ======================================================== */}

      {showEditEvent &&
        selectedEvent && (
        <div
          className="modal-backdrop"

          onMouseDown={() =>
            setShowEditEvent(
              false
            )
          }
        >

          <div
            className="modal"

            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <p className="eyebrow">
                  EDIT EVENT
                </p>

                <h2>
                  Edit Event
                </h2>

              </div>

              <button
                type="button"

                onClick={() =>
                  setShowEditEvent(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleEditEvent
              }
            >

              <label>

                Event Name *

                <input
                  type="text"

                  value={
                    editEventForm.name
                  }

                  onChange={(
                    event
                  ) =>
                    setEditEventForm(
                      (
                        current
                      ) => ({
                        ...current,

                        name:
                          event
                            .target
                            .value,
                      })
                    )
                  }

                  autoFocus
                />

              </label>

              <label>

                Event Date

                <input
                  type="date"

                  value={
                    editEventForm.event_date
                  }

                  onChange={(
                    event
                  ) =>
                    setEditEventForm(
                      (
                        current
                      ) => ({
                        ...current,

                        event_date:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                />

              </label>

              <label>

                Description

                <textarea
                  value={
                    editEventForm.description
                  }

                  onChange={(
                    event
                  ) =>
                    setEditEventForm(
                      (
                        current
                      ) => ({
                        ...current,

                        description:
                          event
                            .target
                            .value,
                      })
                    )
                  }

                  rows="4"
                />

              </label>

              <p>
                Your existing client gallery URL will remain the same.
              </p>

              {editEventError && (
                <div className="error-message">
                  {
                    editEventError
                  }
                </div>
              )}

              <div className="modal-actions">

                <button
                  type="button"

                  onClick={() =>
                    setShowEditEvent(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"

                  className="primary-button"

                  disabled={
                    editingEvent
                  }
                >
                  {editingEvent
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  )
}

// ============================================================
// BULK ACTION BAR
// ============================================================

function BulkActionBar({
  list,
  selectedMessageIds,
  loading,
  statusText,
  onToggleSelectAll,
  onClear,
  onShow,
  onHide,
  onDownload,
  onDelete,
}) {
  const selectedCount =
    list.filter(
      (message) =>
        selectedMessageIds.includes(
          message.id
        )
    ).length

  const allSelected =
    list.length > 0 &&
    selectedCount ===
      list.length

  return (
    <div className="bulk-action-bar">

      <div className="bulk-selection-info">

        <label className="bulk-select-all">

          <input
            type="checkbox"

            checked={
              allSelected
            }

            onChange={
              onToggleSelectAll
            }

            disabled={
              loading
            }
          />

          <span>
            {allSelected
              ? 'Deselect All'
              : 'Select All'}
          </span>

        </label>

        <strong>
          {selectedCount}{' '}
          selected
        </strong>

      </div>

      {statusText && (
        <span className="bulk-action-status">
          {statusText}
        </span>
      )}

      <div className="bulk-action-buttons">

        <button
          type="button"

          disabled={
            selectedCount ===
              0 ||
            loading
          }

          onClick={
            onShow
          }
        >
          👁 Show
        </button>

        <button
          type="button"

          disabled={
            selectedCount ===
              0 ||
            loading
          }

          onClick={
            onHide
          }
        >
          ◉ Hide
        </button>

        <button
          type="button"

          disabled={
            selectedCount ===
              0 ||
            loading
          }

          onClick={
            onDownload
          }
        >
          ↓ Download ZIP
        </button>

        <button
          type="button"

          disabled={
            selectedCount ===
              0 ||
            loading
          }

          onClick={
            onClear
          }
        >
          Clear
        </button>

        <button
          type="button"

          className="danger-button"

          disabled={
            selectedCount ===
              0 ||
            loading
          }

          onClick={
            onDelete
          }
        >
          🗑 Delete Selected
        </button>

      </div>

    </div>
  )
}

// ============================================================
// MESSAGE LIST
// ============================================================

function MessageList({
  messages,
  showEventName = false,
  selectedMessageIds,
  onToggleSelection,
  audioUrls,
  audioLoadingId,
  downloadLoadingId,
  onPlay,
  onDownload,
  onVisibility,
  onDelete,
  onOpenEvent,
}) {
  return (
    <div className="message-list">

      {messages.map(
        (message) => {
          const selected =
            selectedMessageIds.includes(
              message.id
            )

          return (
            <article
              className={
                selected
                  ? 'message-card message-card-selected'
                  : 'message-card'
              }

              key={
                message.id
              }
            >

              <div className="message-select">

                <input
                  type="checkbox"

                  aria-label={`Select Message ${message.message_number}`}

                  checked={
                    selected
                  }

                  onChange={() =>
                    onToggleSelection(
                      message.id
                    )
                  }
                />

              </div>

              <div className="message-number">
                {
                  message.message_number
                }
              </div>

              <div className="message-info">

                <div className="message-title-row">

                  <div>

                    <h3>
                      Message{' '}
                      {
                        message.message_number
                      }
                    </h3>

                    {showEventName &&
                      message.event_name && (
                        <p>
                          <strong>
                            {
                              message.event_name
                            }
                          </strong>
                        </p>
                      )}

                    <p>
                      {message.file_name ||
                        'Recording'}
                    </p>

                  </div>

                  <span
                    className={
                      message.is_visible
                        ? 'visibility-badge visible'
                        : 'visibility-badge hidden'
                    }
                  >
                    {message.is_visible
                      ? 'Visible in Gallery'
                      : 'Hidden from Gallery'}
                  </span>

                </div>

                <div className="message-meta">

                  <span>
                    {formatDuration(
                      message.duration
                    )}
                  </span>

                  <span>
                    {formatFileSize(
                      message.file_size
                    )}
                  </span>

                  <span>
                    {formatDateTime(
                      message.created_at
                    )}
                  </span>

                </div>

                {audioUrls[
                  message.id
                ] && (
                  <audio
                    id={`admin-audio-${message.id}`}

                    controls

                    src={
                      audioUrls[
                        message.id
                      ]
                    }

                    className="admin-audio-player"
                  />
                )}

                <div className="message-actions">

                  <button
                    type="button"

                    disabled={
                      audioLoadingId ===
                      message.id
                    }

                    onClick={() =>
                      onPlay(
                        message
                      )
                    }
                  >
                    {audioLoadingId ===
                    message.id
                      ? 'Loading...'
                      : '▶ Play'}
                  </button>

                  <button
                    type="button"

                    disabled={
                      downloadLoadingId ===
                      message.id
                    }

                    onClick={() =>
                      onDownload(
                        message
                      )
                    }
                  >
                    {downloadLoadingId ===
                    message.id
                      ? 'Downloading...'
                      : '↓ Download'}
                  </button>

                  <button
                    type="button"

                    onClick={() =>
                      onVisibility(
                        message
                      )
                    }
                  >
                    {message.is_visible
                      ? '👁 Hide'
                      : '👁 Show'}
                  </button>

                  {showEventName &&
                    onOpenEvent && (
                      <button
                        type="button"

                        onClick={() =>
                          onOpenEvent(
                            message
                          )
                        }
                      >
                        Open Event →
                      </button>
                    )}

                  <button
                    type="button"

                    className="danger-button"

                    onClick={() =>
                      onDelete(
                        message
                      )
                    }
                  >
                    🗑 Delete
                  </button>

                </div>

              </div>

            </article>
          )
        }
      )}

    </div>
  )
}

// ============================================================
// EVENT LIST
// ============================================================

function EventList({
  events,
  loading,
  error,
  onOpen,
}) {
  if (loading) {
    return (
      <p>
        Loading events...
      </p>
    )
  }

  if (error) {
    return (
      <div className="error-message">
        {error}
      </div>
    )
  }

  if (
    events.length === 0
  ) {
    return (
      <div className="empty-state">

        <h3>
          No events yet
        </h3>

        <p>
          Create your first audio guestbook event.
        </p>

      </div>
    )
  }

  return (
    <div className="events-list">

      {events.map(
        (event) => (
          <button
            type="button"

            className="event-row"

            key={
              event.id
            }

            onClick={() =>
              onOpen(
                event
              )
            }
          >

            <div>

              <strong>
                {
                  event.name
                }
              </strong>

              <span>
                {event.event_date
                  ? formatDate(
                      event.event_date
                    )
                  : 'No event date'}
              </span>

            </div>

            <span>
              View Event →
            </span>

          </button>
        )
      )}

    </div>
  )
}

// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(
  date
) {
  if (!date) {
    return ''
  }

  const parsed =
    new Date(
      `${date}T00:00:00`
    )

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return date
  }

  return parsed.toLocaleDateString(
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

// ============================================================
// FORMAT DATE + TIME
// ============================================================

function formatDateTime(
  value
) {
  if (!value) {
    return ''
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  return date.toLocaleString(
    'en-CA',
    {
      month:
        'short',

      day:
        'numeric',

      year:
        'numeric',

      hour:
        'numeric',

      minute:
        '2-digit',
    }
  )
}

// ============================================================
// FORMAT DURATION
// ============================================================

function formatDuration(
  seconds
) {
  const totalSeconds =
    Math.max(
      0,

      Math.floor(
        Number(
          seconds ||
            0
        )
      )
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
    totalSeconds %
    60

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

// ============================================================
// FORMAT FILE SIZE
// ============================================================

function formatFileSize(
  bytes
) {
  const size =
    Number(
      bytes ||
        0
    )

  if (!size) {
    return '0 B'
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
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

// ============================================================
// FILE EXTENSION
// ============================================================

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

// ============================================================
// SAFE ZIP FOLDER NAME
// ============================================================

function sanitizeFileName(
  value
) {
  return String(
    value ||
      'Event'
  )
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      '_'
    )
    .trim()
    .substring(
      0,
      120
    )
}

export default App