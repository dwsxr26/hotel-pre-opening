import { useState } from 'react'
import { X } from 'lucide-react'
import { displayName } from '../lib/people'

// Admins see the team and can promote/demote other admins.
export default function TeamModal({ profiles, myUserId, onSetAdmin, onClose }) {
  const [busyId, setBusyId] = useState(null)
  const sorted = [...profiles].sort((a, b) => displayName(a).localeCompare(displayName(b)))

  const toggle = async (p) => {
    setBusyId(p.user_id)
    try {
      await onSetAdmin(p.user_id, !p.is_admin)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <button className="me-close" onClick={onClose} title="Close"><X size={18} /></button>
        <h3>Team &amp; admins</h3>
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
                  disabled={busyId === p.user_id}
                  onChange={() => toggle(p)}
                />
                Admin
              </label>
            </div>
          ))}
          {sorted.length === 0 && <div className="me-empty">No teammates yet.</div>}
        </div>
      </div>
    </div>
  )
}
