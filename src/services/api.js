import { supabase } from '../supabaseClient'

export const API_URL = import.meta.env.VITE_AUDIO_API_URL

export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Your login session has expired. Please sign in again.')
  }

  if (!API_URL) {
    throw new Error('VITE_AUDIO_API_URL is not configured.')
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session.access_token}`,
  }

  return fetch(`${API_URL}${path}`, { ...options, headers })
}

export async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`)
  }

  return data
}

export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Your login session has expired.')
  return session.access_token
}
