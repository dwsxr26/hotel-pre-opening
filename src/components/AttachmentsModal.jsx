import { useRef, useState } from 'react'
import { Download, UploadCloud, X } from 'lucide-react'

// A viewport-level modal (so it's never clipped by the table) for uploading
// files via drag & drop or browse, and listing/downloading/removing them.
// `files` omitted (bulk mode) => upload-only, no list.
export default function AttachmentsModal({ title, subtitle, files, onUpload, onRemove, onDownload, onClose }) {
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  const doUpload = async (list) => {
    const arr = [...list]
    if (!arr.length) return
    setBusy(true)
    try {
      await onUpload(arr)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}

        <div
          className={`dropzone ${drag ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            doUpload(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={22} />
          <div>{busy ? 'Uploading…' : 'Drag & drop files here, or click to browse'}</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const f = e.target.files
              e.target.value = ''
              doUpload(f)
            }}
          />
        </div>

        {files && (
          <div className="att-list">
            {files.length === 0 && <div className="att-empty">No files yet</div>}
            {files.map((f) => (
              <div key={f.id} className="att-row">
                <button className="att-name" onClick={() => onDownload(f.path)} title={`Download ${f.filename}`}>
                  <Download size={14} />
                  <span>{f.filename}</span>
                </button>
                {onRemove && (
                  <button className="att-x" onClick={() => onRemove(f.id)} title="Remove">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
