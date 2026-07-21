import { useState } from 'react'
import { Check, Copy, Plus, Trash2, X } from 'lucide-react'
import { displayName } from '../lib/people'

// Admins see the team, can promote/demote other admins, and manage the invite
// allowlist — only emails on that list can create an account.
export default function TeamModal({
  profiles,
  myUserId,
  isAdmin,
  allowedMembers = [],
  onSetAdmin,
  onAddMember,
  onRemoveMember,
  onClose,
}) {
  const [busyId, setBusyId] = useState(null)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [justAdded, setJustAdded] = useState(null)
  const [copied, setCopied] = useState(false)

  const sorted = [...profiles].sort((a, b) => displayName(a).localeCompare(displayName(b)))
  // Emails on the allowlist that haven't signed in yet.
  const signedUp = new Set(profiles.map((p) => (p.email || '').toLowerCase()))
  const pending = allowedMembers.filter((m) => !signedUp.has(m.email))

  const toggle = async (p) => {
    setBusyId(p.user_id)
    try {
      await onSetAdmin(p.user_id, !p.is_admin)
    } finally {
      setBusyId(null)
    }
  }

  const add = async (e) => {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!addr) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError('That doesn’t look like an email address.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await onAddMember(addr)
      setJustAdded(addr)
      setEmail('')
      setCopied(false)
    } catch (err) {
      setError(err?.code === '23505' ? 'That email is already on the list.' : err.message)
    } finally {
      setAdding(false)
    }
  }

  const inviteText = justAdded
    ? `You've been given access to the Florence Pre-Opening tracker.\n\n` +
      `Go to ${window.location.origin} and sign in with this email address (${justAdded}).\n` +
      `You'll get a one-time link by email — no password needed the first time.`
    : ''

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button className="me-close" onClick={onClose} title="Close"><X size={18} /></button>
        <h3>Team &amp; access</h3>
        <p>Admins can edit budgets, owners, and manage who else is an admin.</p>
        <div className="team-list">
          {sorted.map((p) => (
            <div key={p.user_id} className="team-row">
              <div className="team-who">
                <span className="team-name">{displayName(p)}{p.user_id === myUserId ? ' (you)' : ''}</span>
                <span className="team-email">{p.email}</span>
              </div>
              <label className="team-admin">
                <input
                  type="checkbox"
                  checked={!!p.is_admin}
                  disabled={busyId === p.user_id || !isAdmin}
                  onChange={() => toggle(p)}
                />
                Admin
              </label>
            </div>
          ))}
          {sorted.length === 0 && <div className="me-empty">No teammates yet.</div>}
        </div>

        {isAdmin && (
          <>
            <h3 style={{ marginTop: 20 }}>Allow a new person</h3>
            <p>
              Add their email here first — only allowed emails can create an account. Then tell them to
              sign in with that same address.
            </p>
            <form className="invite-row" onSubmit={add}>
              <input
                className="ctrl"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" disabled={adding || !email.trim()}>
                <Plus size={15} /> Allow
              </button>
            </form>
            {error && <div className="me-warn" style={{ marginTop: 8 }}>{error}</div>}

            {justAdded && (
              <div className="invite-done">
                <div>
                  <strong>{justAdded}</strong> can now sign in. Send them this:
                </div>
                <pre className="invite-msg">{inviteText}</pre>
                <button
                  type="button"
                  className="btn"
                  onClick={() => { navigator.clipboard.writeText(inviteText); setCopied(true) }}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy message</>}
                </button>
              </div>
            )}

            {pending.length > 0 && (
              <>
                <div className="card-hd" style={{ padding: '14px 0 6px', border: 0 }}>
                  Allowed, not signed in yet
                </div>
                <div className="team-list">
                  {pending.map((m) => (
                    <div key={m.email} className="team-row">
                      <div className="team-who">
                        <span className="team-email">{m.email}</span>
                      </div>
                      <button
                        className="me-x"
                        title="Remove from the allowlist"
                        onClick={() => onRemoveMember(m.email)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
