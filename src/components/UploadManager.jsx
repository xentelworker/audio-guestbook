import { useRef, useState } from 'react'
import { API_URL, getAccessToken } from '../services/api'

function durationFor(file) {
  return new Promise(resolve => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const value = Number.isFinite(audio.duration) ? audio.duration : 0
      URL.revokeObjectURL(url); resolve(value)
    }
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
    audio.src = url
  })
}

function xhrUpload({ eventId, file, token, duration, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/upload/${encodeURIComponent(eventId)}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    xhr.setRequestHeader('X-File-Size', String(file.size))
    xhr.setRequestHeader('X-Duration', String(duration))
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onerror = () => reject(new Error(`Network error uploading ${file.name}`))
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText || '{}') } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new Error(data.error || `Upload failed (${xhr.status})`))
    }
    xhr.send(file)
  })
}

export default function UploadManager({ eventId, onComplete }) {
  const inputRef = useRef(null)
  const [queue, setQueue] = useState([])
  const [busy, setBusy] = useState(false)

  async function process(files) {
    const items = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`, file, progress: 0, status: 'queued', error: ''
    }))
    setQueue(items)
    setBusy(true)
    const token = await getAccessToken()

    for (const item of items) {
      setQueue(q => q.map(x => x.id === item.id ? {...x, status:'uploading'} : x))
      try {
        const duration = await durationFor(item.file)
        await xhrUpload({
          eventId, file:item.file, token, duration,
          onProgress: progress => setQueue(q => q.map(x => x.id === item.id ? {...x, progress} : x))
        })
        setQueue(q => q.map(x => x.id === item.id ? {...x, progress:100, status:'done'} : x))
      } catch (error) {
        setQueue(q => q.map(x => x.id === item.id ? {...x, status:'error', error:error.message} : x))
      }
    }

    setBusy(false)
    await onComplete?.()
  }

  async function retry(item) {
    setBusy(true)
    try {
      const token = await getAccessToken()
      const duration = await durationFor(item.file)
      setQueue(q => q.map(x => x.id === item.id ? {...x,status:'uploading',error:'',progress:0} : x))
      await xhrUpload({
        eventId, file:item.file, token, duration,
        onProgress: progress => setQueue(q => q.map(x => x.id === item.id ? {...x,progress} : x))
      })
      setQueue(q => q.map(x => x.id === item.id ? {...x,status:'done',progress:100} : x))
      await onComplete?.()
    } catch (error) {
      setQueue(q => q.map(x => x.id === item.id ? {...x,status:'error',error:error.message} : x))
    } finally { setBusy(false) }
  }

  return (
    <div>
      <input
        ref={inputRef} hidden type="file" multiple
        accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*"
        onChange={e => { const files=[...e.target.files]; e.target.value=''; if(files.length) process(files) }}
      />
      <button className="primary-button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Uploading...' : '+ Upload Audio'}
      </button>

      {!!queue.length && (
        <div className="upload-queue">
          {queue.map(item => (
            <div className="upload-item" key={item.id}>
              <div className="upload-item-title">
                <strong>{item.file.name}</strong>
                <span>{item.status === 'error' ? 'Failed' : `${item.progress}%`}</span>
              </div>
              <progress max="100" value={item.progress} />
              {item.error && <div className="error-message compact">{item.error}</div>}
              {item.status === 'error' && <button disabled={busy} onClick={() => retry(item)}>Retry</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
