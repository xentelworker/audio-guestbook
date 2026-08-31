import JSZip from 'jszip'
import { apiFetch } from '../services/api'
import { csvEscape, getFileExtension, sanitizeFileName } from './formatters'

export function messagesToCsv(messages) {
  const headers = [
    'event_name','message_number','label','file_name','duration_seconds',
    'file_size_bytes','visible','created_at','deleted_at'
  ]
  const rows = messages.map(m => [
    m.event_name || '',
    m.message_number,
    m.custom_label || '',
    m.file_name || '',
    m.duration || 0,
    m.file_size || 0,
    Boolean(m.is_visible),
    m.created_at || '',
    m.deleted_at || '',
  ])
  return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n')
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadEventBackup(event, messages, onProgress = () => {}) {
  const zip = new JSZip()
  const folder = zip.folder(sanitizeFileName(event.name || event.slug || 'event'))

  folder.file('event.json', JSON.stringify(event, null, 2))
  folder.file('messages.csv', messagesToCsv(messages))
  folder.file('messages.json', JSON.stringify(messages, null, 2))

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    onProgress(`Downloading ${i + 1} of ${messages.length}...`)
    const response = await apiFetch(`/audio/${encodeURIComponent(message.id)}?download=1`)
    if (!response.ok) throw new Error(`Unable to download Message ${message.message_number}.`)
    const blob = await response.blob()
    const label = message.custom_label
      ? sanitizeFileName(message.custom_label)
      : `Message-${String(message.message_number).padStart(3,'0')}`
    folder.file(`${label}${getFileExtension(message.file_name)}`, blob)
  }

  onProgress('Creating ZIP...')
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.slug || 'event'}-backup.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
