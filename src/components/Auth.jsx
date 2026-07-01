import { useState } from 'react'
import { supabase } from '../supabase'

// Magic-link sign in — the team enters their email and receives a login link.
// No passwords to manage. (Enable "Email" provider in Supabase Auth settings.)
export default function Auth() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null) // {ok, text}
  const [sending, setSending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    setStatus(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
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
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@crossroadsre.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={sending}>
              {sending ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
          {status && <p className={`auth-msg ${status.ok ? 'ok' : 'error'}`}>{status.text}</p>}
        </div>
      </div>
    </div>
  )
}
