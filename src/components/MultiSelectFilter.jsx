import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

// A labelled multi-select dropdown: "Category ▾" with a checklist popover.
// `options` are the values to choose from; `selected`/`onChange` are an array.
// Used on the Orders filter bar and the Summary tabs.
export default function MultiSelectFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const sel = new Set(selected)
  const toggle = (v) => {
    const n = new Set(sel)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    onChange([...n])
  }
  const shown = (options || []).filter((o) => (o || '(blank)').toLowerCase().includes(q.toLowerCase()))

  return (
    <span className="msf" ref={ref}>
      <button type="button" className={`msf-btn ${selected.length ? 'active' : ''}`} onClick={() => setOpen((o) => !o)}>
        {label}
        {selected.length > 0 && <span className="msf-count">{selected.length}</span>}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="filter-pop">
          <div className="filter-search">
            <Search size={13} />
            <input autoFocus placeholder="Find value" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="filter-list">
            {shown.map((v) => (
              <label key={v || '(blank)'} className="filter-opt">
                <input type="checkbox" checked={sel.has(v)} onChange={() => toggle(v)} />
                <span>{v || '(blank)'}</span>
              </label>
            ))}
            {shown.length === 0 && <div className="filter-empty">No matches</div>}
          </div>
          <div className="filter-actions">
            <button className="btn" onClick={() => onChange([])}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
