import { UserPen, UserPlus } from 'lucide-react'
import { supabase } from '../supabase'
import { displayName } from '../lib/people'

export default function Header({ user, profile, onEditName, onInvite }) {
  const name = displayName(profile) || user?.email
  return (
    <div className="header">
      <div className="brand">
        <div className="logo" aria-label="The Usual">U</div>
        <div>
          <div className="eyebrow">The Usual · Florence</div>
          <h1 className="title">Florence Pre-Opening</h1>
          <p className="subtitle">Shared pre-opening spend &amp; order tracker. Allocate owners, set status, track arrivals.</p>
        </div>
      </div>
      <div className="header-actions">
        <button className="btn" onClick={onInvite} title="Invite teammates">
          <UserPlus size={15} /> Invite
        </button>
        <button className="btn" onClick={onEditName} title="Edit your name">
          <UserPen size={15} /> {name}
        </button>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
