import { useState } from 'react'
import { displayName } from '../lib/people'

// Collects the signed-in user's name and (for new users) a password.
//  - required: can't be dismissed (used to complete onboarding).
//  - passwordSet: whether the user already has a password. If not, a password
//    is required here; if so, the password fields are an optional change.
// Calls onSave({ first_name, last_name, password }) where password === ''
// means "leave the current password unchanged".
export default function ProfileModal({ profile, required = false, passwordSet = false, onSave, onClose }) {
  const [first, setFirst] = useState(profile?.first_name || '')
  const [last, setLast] = useState(profile?.last_name || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mustSetPassword = !passwordSet
  const preview = displayName({ first_name: first, last_name: last, email: profile?.email })

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (!first.trim()) return setError('Please enter your first name.')

    const wantsPassword = mustSetPassword || password || confirm
    if (wantsPassword) {
      if (password.length < 8) return setError('Password must be at least 8 characters.')
      if (password !== confirm) return setError('Passwords do not match.')
    }

    setSaving(true)
    try {
      await onSave({ first_name: first, last_name: last, password: wantsPassword ? password : '' })
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !required && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{mustSetPassword ? 'Finish setting up your account' : 'Your account'}</h3>
        <p>
          Set how you appear in the Owner dropdown{mustSetPassword ? ' and choose a password' : ''}.
          {profile?.email && <span> Linked to {profile.email}.</span>}
        </p>
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="first">First name</label>
            <input id="first" autoFocus value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Diederik" />
          </div>
          <div className="field">
            <label htmlFor="last">Last name</label>
            <input id="last" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Scholten" />
          </div>

          <div className="field">
            <label htmlFor="pw">{mustSetPassword ? 'Password' : 'New password (optional)'}</label>
            <input
              id="pw"
              type="password"
              value={password}
              placeholder={mustSetPassword ? 'At least 8 characters' : 'Leave blank to keep current'}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {(mustSetPassword || password) && (
            <div className="field">
              <label htmlFor="pw2">Confirm password</label>
              <input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          )}

          <p className="from-to" style={{ marginBottom: 12 }}>
            Shown as <span className="new">{preview || '—'}</span>
          </p>
          {error && <p className="auth-msg error" style={{ marginTop: 0 }}>{error}</p>}

          <div className="modal-actions">
            {!required && (
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
            )}
            <button className="btn btn-primary" disabled={saving || !first.trim()}>
              {saving ? 'Saving…' : mustSetPassword ? 'Save & continue' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
