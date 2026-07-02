import { useEffect, useRef, useState } from 'react'
import { Paperclip, Download, X, Plus } from 'lucide-react'

// Files column cell: a paperclip + count. Clicking opens a popover listing the
// linked files (download / remove) with an upload button. Files are fetched
// lazily on download, so this never slows the grid.
export default function AttachmentsCell({ itemId, files = [], onUpload, onRemove, onDownload }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  const fileInput = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pickFiles = async (e) => {
    const chosen = [...e.target.files]
    e.target.value = ''
    if (!chosen.length) return
    setBusy(true)
    try {
      await onUpload(itemId, chosen)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="att-cell" ref={ref}>
      <button
        type="button"
        className={`att-btn ${files.length ? 'has' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={files.length ? `${files.length} file(s)` : 'Add file'}
      >
        <Paperclip size={14} />
        {files.length > 0 && <span className="att-count">{files.length}</span>}
      </button>
      {open && (
        <div className="att-pop">
          {files.length === 0 && <div className="att-empty">No files yet</div>}
          {files.map((f) => (
            <div key={f.id} className="att-row">
              <button className="att-name" title={`Download ${f.filename}`} onClick={() => onDownload(f.path)}>
                <Download size={13} />
                <span>{f.filename}</span>
              </button>
              <button className="att-x" title="Remove" onClick={() => onRemove(itemId, f.id)}>
                <X size={13} />
              </button>
            </div>
          ))}
          <button className="btn att-add" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Plus size={13} /> {busy ? 'Uploading…' : 'Add file'}
          </button>
          <input ref={fileInput} type="file" multiple hidden onChange={pickFiles} />
        </div>
      )}
    </span>
  )
}
