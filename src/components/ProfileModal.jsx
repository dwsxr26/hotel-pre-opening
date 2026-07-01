import { useState } from 'react'
import { displayName } from '../lib/people'

// Lets the signed-in user set their first and last name. The Owner dropdown
// shows everyone as "First L." (built from these). `required` hides the cancel
// button for the first-time prompt.
export default function ProfileModal({ profile, required = false, onSave, onClose }) {
  const [first, setFirst] = useState(profile?.first_name || '')
  const [last, setLast] = useState(profile?.last_name || '')
  const [saving, setSaving] = useState(false)

  const preview = displayName({ first_name: first, last_name: last, email: profile?.email })

  const save = async (e) => {
    e.preventDefault()
    if (!first.trim()) return
    setSaving(true)
    try {
      await onSave({ first_name: first, last_name: last })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !required && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Your name</h3>
        <p>
          This is how you appear in the Owner dropdown. {profile?.email && <span>Linked to {profile.email}.</span>}
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
          <p className="from-to" style={{ marginBottom: 14 }}>
            Shown as <span className="new">{preview || '—'}</span>
          </p>
          <div className="modal-actions">
            {!required && (
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
            )}
            <button className="btn btn-primary" disabled={saving || !first.trim()}>
              {saving ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
