import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Guestbook from './pages/Guestbook'
import Sidebar from './components/Sidebar'
import EventList from './components/EventList'
import MessageList from './components/MessageList'
import BulkActionBar from './components/BulkActionBar'
import UploadManager from './components/UploadManager'
import { apiFetch, apiJson, API_URL } from './services/api'
import {
  formatDate, formatDateTime, formatDuration, formatFileSize,
  getFileExtension, sanitizeFileName
} from './utils/formatters'
import { downloadEventBackup, downloadText, messagesToCsv } from './utils/exports'
import './App.css'
import './operations.css'

function App() {
  const [user,setUser]=useState(null)
  const [checkingAuth,setCheckingAuth]=useState(true)
  const [page,setPage]=useState('dashboard')
  const [events,setEvents]=useState([])
  const [eventsLoading,setEventsLoading]=useState(false)
  const [selectedEvent,setSelectedEvent]=useState(null)
  const [messages,setMessages]=useState([])
  const [globalMessages,setGlobalMessages]=useState([])
  const [trash,setTrash]=useState([])
  const [activity,setActivity]=useState([])
  const [audioUrls,setAudioUrls]=useState({})
  const [selectedIds,setSelectedIds]=useState([])
  const [bulkBusy,setBulkBusy]=useState(false)
  const [bulkStatus,setBulkStatus]=useState('')
  const [exportStatus,setExportStatus]=useState('')
  const [showCreate,setShowCreate]=useState(false)
  const [showEdit,setShowEdit]=useState(false)
  const [form,setForm]=useState({name:'',event_date:'',description:''})
  const [eventSearch,setEventSearch]=useState('')
  const [eventArchiveFilter,setEventArchiveFilter]=useState('active')
  const [eventSort,setEventSort]=useState('date-desc')
  const [messageSearch,setMessageSearch]=useState('')
  const [messageEventFilter,setMessageEventFilter]=useState('all')
  const [messageVisibilityFilter,setMessageVisibilityFilter]=useState('all')
  const [messageSort,setMessageSort]=useState('newest')

  useEffect(()=>{
    let alive=true
    supabase.auth.getSession().then(({data:{session}})=>{
      if(alive){setUser(session?.user||null);setCheckingAuth(false)}
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{
      setUser(session?.user||null);setCheckingAuth(false)
    })
    return ()=>{alive=false;subscription.unsubscribe()}
  },[])

  useEffect(()=>{ if(user) refreshAll() },[user])

  const guestbookMatch=window.location.pathname.match(/^\/guestbook\/([^/]+)\/?$/)
  if(guestbookMatch) return <Guestbook slug={decodeURIComponent(guestbookMatch[1])}/>

  async function refreshAll(){
    await loadEvents()
  }

  async function loadEvents(){
    setEventsLoading(true)
    try{
      const data=await apiJson('/events')
      const next=data.events||[]
      setEvents(next)
      await loadGlobalMessages(next)
    }catch(e){alert(e.message)}
    finally{setEventsLoading(false)}
  }

  async function loadGlobalMessages(eventList=events){
    try{
      const results=await Promise.all(eventList.map(async ev=>{
        const data=await apiJson(`/messages/${encodeURIComponent(ev.id)}`)
        return (data.messages||data||[]).map(m=>({...m,event_name:ev.name,event_slug:ev.slug,event_date:ev.event_date}))
      }))
      setGlobalMessages(results.flat())
    }catch(e){console.error(e)}
  }

  async function openEvent(ev){
    setSelectedEvent(ev);setPage('event-details');setSelectedIds([])
    await loadMessages(ev.id)
  }

  function openClientGallery(ev){
    const galleryUrl=`${window.location.origin}/guestbook/${encodeURIComponent(ev.slug)}`
    window.open(galleryUrl,'_blank','noopener,noreferrer')
  }

  async function loadMessages(eventId){
    const data=await apiJson(`/messages/${encodeURIComponent(eventId)}`)
    setMessages(data.messages||data||[])
  }

  async function createEvent(e){
    e.preventDefault()
    const data=await apiJson('/event',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)
    })
    setShowCreate(false);setForm({name:'',event_date:'',description:''})
    await loadEvents(); if(data.event) await openEvent(data.event)
  }

  async function saveEdit(e){
    e.preventDefault()
    const data=await apiJson(`/event/${selectedEvent.id}`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)
    })
    setShowEdit(false);setSelectedEvent(data.event);await loadEvents()
  }

  async function duplicateEvent(ev){
    const name=window.prompt('Name for the duplicated event:',`${ev.name} Copy`)
    if(!name)return
    await apiJson(`/event/${ev.id}/duplicate`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})
    })
    await loadEvents()
  }

  async function toggleArchive(ev){
    await apiJson(`/event/${ev.id}`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({archived_at:ev.archived_at?null:new Date().toISOString()})
    })
    await loadEvents()
    if(selectedEvent?.id===ev.id){
      const fresh=(await apiJson('/events')).events.find(x=>x.id===ev.id)
      if(fresh)setSelectedEvent(fresh)
    }
  }

  async function permanentDeleteEvent(ev){
    if(!window.confirm(`Permanently delete "${ev.name}" and all of its recordings? This cannot be undone.`))return
    await apiJson(`/event/${ev.id}`,{method:'DELETE'})
    if(selectedEvent?.id===ev.id){setSelectedEvent(null);setPage('events');setMessages([])}
    await loadEvents()
  }

  async function playMessage(message){
    if(audioUrls[message.id]){
      document.getElementById(`admin-audio-${message.id}`)?.play()
      return
    }
    const response=await apiFetch(`/audio/${message.id}`)
    if(!response.ok)return alert('Unable to load audio.')
    const blob=await response.blob()
    const url=URL.createObjectURL(blob)
    setAudioUrls(v=>({...v,[message.id]:url}))
    setTimeout(()=>document.getElementById(`admin-audio-${message.id}`)?.play(),50)
  }

  async function downloadMessage(message){
    const response=await apiFetch(`/audio/${message.id}?download=1`)
    if(!response.ok)return alert('Unable to download recording.')
    const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a')
    a.href=url;a.download=message.file_name||`message-${message.message_number}`
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
  }

  async function setVisibility(message,visible=!message.is_visible){
    const data=await apiJson(`/visibility/${message.id}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_visible:visible})
    })
    updateMessage(data.message)
  }

  async function renameMessage(message){
    const label=window.prompt('Guest label / message name:',message.custom_label||'')
    if(label===null)return
    const data=await apiJson(`/message/${message.id}`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({custom_label:label.trim()||null})
    })
    updateMessage(data.message)
  }

  async function reorderMessages(reordered){
    setMessages(reordered)
    try{
      for(let i=0;i<reordered.length;i++){
        const m=reordered[i]
        if(Number(m.sort_order)!==i+1){
          const data=await apiJson(`/message/${m.id}`,{
            method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sort_order:i+1})
          })
          reordered[i]=data.message
        }
      }
      setMessages([...reordered]);await loadGlobalMessages()
    }catch(e){alert(e.message);await loadMessages(selectedEvent.id)}
  }

  function updateMessage(updated){
    setMessages(v=>v.map(m=>m.id===updated.id?{...m,...updated}:m))
    setGlobalMessages(v=>v.map(m=>m.id===updated.id?{...m,...updated}:m))
  }

  async function trashMessage(message){
    if(!window.confirm(`Move "${message.custom_label||`Message ${message.message_number}`}" to Trash?`))return
    await apiJson(`/message/${message.id}`,{method:'DELETE'})
    setMessages(v=>v.filter(m=>m.id!==message.id))
    setGlobalMessages(v=>v.filter(m=>m.id!==message.id))
    setSelectedIds(v=>v.filter(id=>id!==message.id))
  }

  function toggleSelection(id){setSelectedIds(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
  function toggleAll(list){
    const ids=list.map(m=>m.id),all=ids.length&&ids.every(id=>selectedIds.includes(id))
    setSelectedIds(all?[]:ids)
  }
  function selectedFrom(list){return list.filter(m=>selectedIds.includes(m.id))}

  async function bulkVisibility(list,visible){
    const chosen=selectedFrom(list);if(!chosen.length)return
    setBulkBusy(true)
    try{
      for(let i=0;i<chosen.length;i++){setBulkStatus(`${visible?'Showing':'Hiding'} ${i+1} of ${chosen.length}...`);await setVisibility(chosen[i],visible)}
      setSelectedIds([])
    }finally{setBulkBusy(false);setBulkStatus('')}
  }

  async function bulkTrash(list){
    const chosen=selectedFrom(list);if(!chosen.length)return
    if(!window.confirm(`Move ${chosen.length} selected recording(s) to Trash?`))return
    setBulkBusy(true)
    try{
      for(let i=0;i<chosen.length;i++){
        setBulkStatus(`Moving ${i+1} of ${chosen.length} to Trash...`)
        await apiJson(`/message/${chosen[i].id}`,{method:'DELETE'})
      }
      setSelectedIds([])
      if(selectedEvent)await loadMessages(selectedEvent.id)
      await loadGlobalMessages()
    }finally{setBulkBusy(false);setBulkStatus('')}
  }

  async function bulkZip(list){
    const chosen=selectedFrom(list);if(!chosen.length)return
    setBulkBusy(true)
    try{
      const zip=new JSZip()
      for(let i=0;i<chosen.length;i++){
        const m=chosen[i];setBulkStatus(`Downloading ${i+1} of ${chosen.length}...`)
        const response=await apiFetch(`/audio/${m.id}?download=1`)
        if(!response.ok)throw new Error(`Unable to download Message ${m.message_number}.`)
        const blob=await response.blob()
        const folder=m.event_name?zip.folder(sanitizeFileName(m.event_name)):zip
        folder.file(`${sanitizeFileName(m.custom_label||`Message-${String(m.message_number).padStart(3,'0')}`)}${getFileExtension(m.file_name)}`,blob)
      }
      const blob=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(blob),a=document.createElement('a')
      a.href=url;a.download='selected-audio-recordings.zip';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
      setSelectedIds([])
    }finally{setBulkBusy(false);setBulkStatus('')}
  }

  async function loadTrash(){
    const data=await apiJson('/trash')
    setTrash(data.messages||[])
    setPage('trash')
  }

  async function restoreMessage(message){
    await apiJson(`/message/${message.id}/restore`,{method:'POST'})
    await loadTrash();await loadEvents()
  }

  async function purgeMessage(message){
    if(!window.confirm('Permanently delete this recording from R2 and the database?'))return
    await apiJson(`/message/${message.id}/permanent`,{method:'DELETE'})
    await loadTrash()
  }

  async function emptyTrash(){
    if(!window.confirm('Permanently delete every item currently in Trash?'))return
    await apiJson('/purge-trash',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})})
    await loadTrash()
  }

  async function loadActivity(){
    const data=await apiJson('/activity?limit=250')
    setActivity(data.activity||[])
    setPage('activity')
  }

  async function navigate(destination){
    setSelectedIds([])
    if(destination==='trash')return loadTrash()
    if(destination==='activity')return loadActivity()
    setPage(destination)
    if(destination!=='event-details')setSelectedEvent(null)
  }

  async function logout(){
    Object.values(audioUrls).forEach(URL.revokeObjectURL)
    await supabase.auth.signOut()
  }

  async function exportEvent(){
    setExportStatus('Preparing backup...')
    try{await downloadEventBackup(selectedEvent,messages,setExportStatus)}
    catch(e){alert(e.message)}
    finally{setExportStatus('')}
  }

  function exportCsv(list=globalMessages){
    downloadText('audio-guestbook-messages.csv',messagesToCsv(list),'text/csv;charset=utf-8')
  }

  const filteredEvents=useMemo(()=>{
    let out=events.filter(e=>e.name.toLowerCase().includes(eventSearch.trim().toLowerCase()))
    if(eventArchiveFilter==='active')out=out.filter(e=>!e.archived_at)
    if(eventArchiveFilter==='archived')out=out.filter(e=>e.archived_at)
    out=[...out].sort((a,b)=>{
      if(eventSort==='name')return a.name.localeCompare(b.name)
      const av=a.event_date||'',bv=b.event_date||''
      return eventSort==='date-asc'?av.localeCompare(bv):bv.localeCompare(av)
    })
    return out
  },[events,eventSearch,eventArchiveFilter,eventSort])

  const filteredMessages=useMemo(()=>{
    let out=[...globalMessages]
    const q=messageSearch.trim().toLowerCase()
    if(q)out=out.filter(m=>`${m.event_name} ${m.custom_label||''} ${m.file_name||''} ${m.message_number}`.toLowerCase().includes(q))
    if(messageEventFilter!=='all')out=out.filter(m=>m.event_id===messageEventFilter)
    if(messageVisibilityFilter==='visible')out=out.filter(m=>m.is_visible)
    if(messageVisibilityFilter==='hidden')out=out.filter(m=>!m.is_visible)
    out.sort((a,b)=>{
      if(messageSort==='oldest')return new Date(a.created_at)-new Date(b.created_at)
      if(messageSort==='event')return String(a.event_name).localeCompare(String(b.event_name))
      return new Date(b.created_at)-new Date(a.created_at)
    })
    return out
  },[globalMessages,messageSearch,messageEventFilter,messageVisibilityFilter,messageSort])

  const activeEvents=events.filter(e=>!e.archived_at)
  const totalStorage=globalMessages.reduce((s,m)=>s+Number(m.file_size||0),0)
  const totalDuration=globalMessages.reduce((s,m)=>s+Number(m.duration||0),0)
  const largest=[...globalMessages].sort((a,b)=>Number(b.file_size||0)-Number(a.file_size||0))[0]
  const average=globalMessages.length?totalDuration/globalMessages.length:0

  if(checkingAuth)return <div className="loading-screen">Loading...</div>
  if(!user)return <Login/>

  return (
    <div className="app-shell">
      <Sidebar page={page} user={user} onNavigate={navigate} onLogout={logout}/>
      <main className="main-content">
        {page==='dashboard'&&<>
          <div className="page-header"><div><p className="eyebrow">OVERVIEW</p><h1>Dashboard</h1><p>Operational overview for your audio guestbook business.</p></div><button className="primary-button" onClick={()=>{setForm({name:'',event_date:'',description:''});setShowCreate(true)}}>+ Create Event</button></div>
          <div className="stats-grid">
            <div className="stat-card"><span>Active Events</span><strong>{activeEvents.length}</strong><small>{events.length-activeEvents.length} archived</small></div>
            <div className="stat-card"><span>Total Messages</span><strong>{globalMessages.length}</strong><small>{globalMessages.filter(m=>m.is_visible).length} visible</small></div>
            <div className="stat-card"><span>Total Audio</span><strong>{formatDuration(totalDuration)}</strong><small>Average {formatDuration(average)}</small></div>
            <div className="stat-card"><span>Storage Used</span><strong>{formatFileSize(totalStorage)}</strong><small>Largest {largest?formatFileSize(largest.file_size):'0 B'}</small></div>
          </div>
          <section className="content-card"><div className="section-header"><div><h2>Recent Events</h2><p>Your active event library.</p></div></div>
            <EventList events={activeEvents.slice(0,5)} onOpen={openEvent} onGallery={openClientGallery} onDuplicate={duplicateEvent} onArchive={toggleArchive} onDelete={permanentDeleteEvent}/>
          </section>
        </>}

        {page==='events'&&<>
          <div className="page-header"><div><p className="eyebrow">EVENTS</p><h1>Events</h1><p>Search, sort, archive, duplicate and manage events.</p></div><button className="primary-button" onClick={()=>{setForm({name:'',event_date:'',description:''});setShowCreate(true)}}>+ Create Event</button></div>
          <section className="content-card">
            <div className="operational-controls">
              <label>Search<input value={eventSearch} onChange={e=>setEventSearch(e.target.value)} placeholder="Event name"/></label>
              <label>Status<select value={eventArchiveFilter} onChange={e=>setEventArchiveFilter(e.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
              <label>Sort<select value={eventSort} onChange={e=>setEventSort(e.target.value)}><option value="date-desc">Newest date</option><option value="date-asc">Oldest date</option><option value="name">Name</option></select></label>
            </div>
            {eventsLoading?<p>Loading events...</p>:<EventList events={filteredEvents} onOpen={openEvent} onGallery={openClientGallery} onDuplicate={duplicateEvent} onArchive={toggleArchive} onDelete={permanentDeleteEvent}/>}
          </section>
        </>}

        {page==='event-details'&&selectedEvent&&<>
          <button className="back-button" onClick={()=>navigate('events')}>← Back to Events</button>
          <div className="page-header">
            <div><p className="eyebrow">EVENT</p><h1>{selectedEvent.name}</h1><p>{formatDate(selectedEvent.event_date)}{selectedEvent.archived_at?' · Archived':''}</p>{selectedEvent.description&&<p>{selectedEvent.description}</p>}</div>
            <div className="event-details-tools">
              <button className="primary-button" onClick={()=>openClientGallery(selectedEvent)}>🌐 Client Gallery</button>
              <button onClick={()=>{setForm({name:selectedEvent.name,event_date:selectedEvent.event_date||'',description:selectedEvent.description||''});setShowEdit(true)}}>✎ Edit</button>
              <button onClick={()=>duplicateEvent(selectedEvent)}>Duplicate</button>
              <button onClick={()=>toggleArchive(selectedEvent)}>{selectedEvent.archived_at?'Unarchive':'Archive'}</button>
              <button onClick={exportEvent}>{exportStatus||'Backup ZIP'}</button>
              <button onClick={()=>exportCsv(messages.map(m=>({...m,event_name:selectedEvent.name})))}>CSV</button>
              <button className="danger-button" onClick={()=>permanentDeleteEvent(selectedEvent)}>Delete Event</button>
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><span>Recordings</span><strong>{messages.length}</strong></div>
            <div className="stat-card"><span>Visible</span><strong>{messages.filter(m=>m.is_visible).length}</strong></div>
            <div className="stat-card"><span>Total Audio</span><strong>{formatDuration(messages.reduce((s,m)=>s+Number(m.duration||0),0))}</strong></div>
            <div className="stat-card"><span>Storage</span><strong>{formatFileSize(messages.reduce((s,m)=>s+Number(m.file_size||0),0))}</strong></div>
          </div>
          <section className="content-card"><div className="section-header"><div><h2>Upload Audio</h2><p>Per-file progress with retry for failed uploads.</p></div></div><UploadManager eventId={selectedEvent.id} onComplete={async()=>{await loadMessages(selectedEvent.id);await loadGlobalMessages()}}/></section>
          <section className="content-card">
            <div className="section-header"><div><h2>Guest Recordings</h2><p>Drag recordings to change the public gallery order.</p></div></div>
            {!!messages.length&&<BulkActionBar list={messages} selectedIds={selectedIds} busy={bulkBusy} status={bulkStatus} onToggleAll={()=>toggleAll(messages)} onClear={()=>setSelectedIds([])} onShow={()=>bulkVisibility(messages,true)} onHide={()=>bulkVisibility(messages,false)} onDownload={()=>bulkZip(messages)} onDelete={()=>bulkTrash(messages)}/>}
            <MessageList messages={messages} selectedIds={selectedIds} onToggleSelect={toggleSelection} onPlay={playMessage} audioUrls={audioUrls} onDownload={downloadMessage} onVisibility={setVisibility} onDelete={trashMessage} onRename={renameMessage} onReorder={reorderMessages}/>
          </section>
        </>}

        {page==='messages'&&<>
          <div className="page-header"><div><p className="eyebrow">MESSAGES</p><h1>All Messages</h1><p>Search and operate across every active and archived event.</p></div><button onClick={()=>exportCsv(filteredMessages)}>Export CSV</button></div>
          <section className="content-card">
            <div className="operational-controls">
              <label>Search<input value={messageSearch} onChange={e=>{setMessageSearch(e.target.value);setSelectedIds([])}} placeholder="Event, label, file, number"/></label>
              <label>Event<select value={messageEventFilter} onChange={e=>{setMessageEventFilter(e.target.value);setSelectedIds([])}}><option value="all">All Events</option>{events.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label>
              <label>Visibility<select value={messageVisibilityFilter} onChange={e=>{setMessageVisibilityFilter(e.target.value);setSelectedIds([])}}><option value="all">All</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select></label>
              <label>Sort<select value={messageSort} onChange={e=>setMessageSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="event">Event</option></select></label>
            </div>
            {!!filteredMessages.length&&<BulkActionBar list={filteredMessages} selectedIds={selectedIds} busy={bulkBusy} status={bulkStatus} onToggleAll={()=>toggleAll(filteredMessages)} onClear={()=>setSelectedIds([])} onShow={()=>bulkVisibility(filteredMessages,true)} onHide={()=>bulkVisibility(filteredMessages,false)} onDownload={()=>bulkZip(filteredMessages)} onDelete={()=>bulkTrash(filteredMessages)}/>}
            <MessageList messages={filteredMessages} selectedIds={selectedIds} onToggleSelect={toggleSelection} onPlay={playMessage} audioUrls={audioUrls} onDownload={downloadMessage} onVisibility={setVisibility} onDelete={trashMessage} onRename={renameMessage} showEventName onOpenEvent={m=>{const ev=events.find(e=>e.id===m.event_id);if(ev)openEvent(ev)}}/>
          </section>
        </>}

        {page==='trash'&&<>
          <div className="page-header"><div><p className="eyebrow">RECOVERY</p><h1>Trash</h1><p>Deleted recordings are retained until permanently purged. The Worker can auto-purge items older than 30 days when a daily Cron Trigger is enabled.</p></div><button className="danger-button" disabled={!trash.length} onClick={emptyTrash}>Empty Trash</button></div>
          <section className="content-card"><div className="trash-list">
            {!trash.length&&<div className="empty-state"><h3>Trash is empty</h3></div>}
            {trash.map(m=><div className="trash-row" key={m.id}><div><strong>{m.custom_label||`Message ${m.message_number}`}</strong><p>{m.event_name||m.file_name} · deleted {formatDateTime(m.deleted_at)}</p></div><div className="message-actions"><button onClick={()=>restoreMessage(m)}>Restore</button><button className="danger-button" onClick={()=>purgeMessage(m)}>Delete Permanently</button></div></div>)}
          </div></section>
        </>}

        {page==='activity'&&<>
          <div className="page-header"><div><p className="eyebrow">AUDIT</p><h1>Activity</h1><p>Recent operational changes made through the Worker API.</p></div><button onClick={loadActivity}>Refresh</button></div>
          <section className="content-card"><div className="activity-list">
            {!activity.length&&<div className="empty-state"><h3>No activity recorded yet</h3></div>}
            {activity.map(a=><div className="activity-row" key={a.id}><div><strong>{a.action.replaceAll('_',' ')}</strong><p>{a.entity_type}{a.details?.name?` · ${a.details.name}`:''}</p></div><span>{formatDateTime(a.created_at)}</span></div>)}
          </div></section>
        </>}

        {page==='settings'&&<>
          <div className="page-header"><div><p className="eyebrow">SETTINGS</p><h1>Settings</h1></div></div>
          <section className="content-card"><h2>System Status</h2><div className="settings-list">
            <div><span>Supabase Auth</span><strong>Connected</strong></div>
            <div><span>Supabase Database</span><strong>Connected</strong></div>
            <div><span>Cloudflare R2</span><strong>Connected</strong></div>
            <div><span>Audio API</span><strong>{API_URL?'Configured':'Missing'}</strong></div>
            <div><span>Trash Retention</span><strong>30 days</strong></div>
          </div></section>
        </>}
      </main>

      {(showCreate||showEdit)&&<div className="modal-backdrop" onMouseDown={()=>{setShowCreate(false);setShowEdit(false)}}>
        <div className="modal" onMouseDown={e=>e.stopPropagation()}>
          <div className="modal-header"><div><p className="eyebrow">{showEdit?'EDIT EVENT':'NEW EVENT'}</p><h2>{showEdit?'Edit Event':'Create Event'}</h2></div><button onClick={()=>{setShowCreate(false);setShowEdit(false)}}>×</button></div>
          <form onSubmit={showEdit?saveEdit:createEvent}>
            <label>Event Name *<input required value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>
            <label>Event Date<input type="date" value={form.event_date} onChange={e=>setForm(v=>({...v,event_date:e.target.value}))}/></label>
            <label>Description<textarea rows="4" value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
            <div className="modal-actions"><button type="button" onClick={()=>{setShowCreate(false);setShowEdit(false)}}>Cancel</button><button className="primary-button" type="submit">{showEdit?'Save Changes':'Create Event'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  )
}
export default App
