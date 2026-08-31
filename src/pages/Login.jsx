import { useState } from 'react'
import { supabase } from '../lib/supabase'

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event) {
    event.preventDefault()

    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    onLogin(data.user)
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-logo">
          🎙
        </div>

        <h1>Audio Guestbook</h1>

        <p className="login-subtitle">
          Sign in to manage your events and recordings
        </p>

        <form onSubmit={handleLogin}>

          <label>Email address</label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

        </form>

      </div>
    </div>
  )
}

export default Login