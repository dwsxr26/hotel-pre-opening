import { useEffect } from 'react'

// Generic confirmation dialog used before committing sensitive edits
// (package, item, category, unit price). `change` optionally renders a
// from -> to preview.
export default function ConfirmModal({ open, title, message, change, confirmLabel = 'Save change', onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        {change && (
          <p className="from-to">
            <span className="old">{change.from || '(empty)'}</span>
            {'  →  '}
            <span className="new">{change.to || '(empty)'}</span>
          </p>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
