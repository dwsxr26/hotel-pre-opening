import { useRef, useState } from 'react'
import { UploadCloud, X } from 'lucide-react'

// Small drag-and-drop (or browse) picker. Returns the chosen File via onSelect;
// the caller decides when to upload (here: deferred to commit).
export default function FileDropModal({ title = 'Attach evidence', onSelect, onClose }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)
  const pick = (f) => {
    if (!f) return
    onSelect(f)
    onClose()
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420, position: 'relative' }} onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close"><X size={18} /></button>
        <h3>{title}</h3>
        <div
          className={`dropzone ${drag ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={22} />
          <div>Drag &amp; drop a file here, or click to browse</div>
          <input ref={inputRef} type="file" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; pick(f) }} />
        </div>
      </div>
    </div>
  )
}
