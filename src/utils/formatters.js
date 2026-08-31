export function formatDate(value) {
  if (!value) return 'No date'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-CA', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
}

export function formatDuration(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
           : `${m}:${String(s).padStart(2,'0')}`
}

export function formatFileSize(value) {
  const bytes = Number(value || 0)
  if (!bytes) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)), units.length-1)
  return `${(bytes/1024**i).toFixed(i ? 1 : 0)} ${units[i]}`
}

export function getFileExtension(name) {
  const match = String(name || '').match(/(\.[a-z0-9]+)$/i)
  return match ? match[1] : '.mp3'
}

export function sanitizeFileName(value) {
  return String(value || 'Event')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .slice(0, 120)
}

export function csvEscape(value) {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
