import { useState } from 'react'
import { supabase } from '../supabase'

// Sign in with either a password or a magic link. Both use the Supabase "Email"
// provider; enable it under Authentication settings.
export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(null) // {ok, text}
  const [busy, setBusy] = useState(false)

  const signInPassword = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    // On success the auth listener swaps this screen out; only errors surface here.
    if (error) setStatus({ ok: false, text: error.message })
  }

  const sendMagicLink = async () => {
    if (!email.trim()) return setStatus({ ok: false, text: 'Enter your email first.' })
    setBusy(true)
    setStatus(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setStatus({ ok: false, text: error.message })
    else setStatus({ ok: true, text: 'Check your inbox for a sign-in link.' })
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="eyebrow">The Usual · Florence</div>
          <h1 className="title" style={{ marginTop: 4 }}>
            Florence Pre-Opening
          </h1>
          <p className="subtitle">Sign in to view and update the order tracker.</p>
        </div>
        <div className="card">
          <form onSubmit={signInPassword}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="yourname@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Sign in'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={busy}
            onClick={sendMagicLink}
          >
            Email me a sign-in link
          </button>

          {status && <p className={`auth-msg ${status.ok ? 'ok' : 'error'}`}>{status.text}</p>}
        </div>
      </div>
    </div>
  )
}
