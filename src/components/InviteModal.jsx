import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Invite teammates. Because sign-in creates an account on first use (magic link
// or password), "inviting" is just sharing the app link — no admin step needed.
// They sign in with their own email, then set their name.
export default function InviteModal({ onClose }) {
  const url = window.location.origin
  const message =
    `You're invited to the Florence Pre-Opening tracker.\n\n` +
    `1. Open ${url}\n` +
    `2. Sign in with your work email (you'll get a one-time link, or use a password if one was set for you)\n` +
    `3. Add your first and last name so you show up in the Owner dropdown`
  const [copied, setCopied] = useState('')

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      setCopied('')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Invite teammates</h3>
        <p>Share the link below. Anyone who signs in with their email gets access and can set their own name.</p>

        <div className="field">
          <label>App link</label>
          <div className="invite-row">
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={() => copy('link', url)}>
              {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => copy('msg', message)}>
            {copied === 'msg' ? <Check size={14} /> : <Copy size={14} />}
            {copied === 'msg' ? 'Copied invite' : 'Copy invite message'}
          </button>
          <a className="btn btn-primary" href={`mailto:?subject=${encodeURIComponent('Florence Pre-Opening tracker')}&body=${encodeURIComponent(message)}`}>
            Email invite
          </a>
        </div>
        <p className="hint" style={{ marginTop: 14 }}>
          Prefer to pre-create accounts? You can also add users in Supabase → Authentication → Users.
        </p>
      </div>
    </div>
  )
}
