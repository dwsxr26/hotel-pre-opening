import { supabase } from '../supabase'

export default function Header({ user }) {
  return (
    <div className="header">
      <div>
        <div className="eyebrow">The Usual · Florence</div>
        <h1 className="title">Florence Pre-Opening</h1>
        <p className="subtitle">Shared pre-opening spend &amp; order tracker. Allocate owners, set status, track arrivals.</p>
      </div>
      <div className="header-actions">
        {user && <span className="user-chip">{user.email}</span>}
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
