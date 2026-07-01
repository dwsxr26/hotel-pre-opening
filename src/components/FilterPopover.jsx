import { useEffect, useRef, useState } from 'react'
import { Filter, Search } from 'lucide-react'

// Header filter, opened from the funnel icon in a column header.
//  - Enumerable columns (package, category, department, owner, status,
//    supplier) get a searchable checkbox list of distinct values.
//  - Free-text columns get a "contains" text box.
// The filter value written to TanStack is either { type:'set', values:[...] }
// or { type:'text', text:'...' }; see the matching filterFn in OrdersTable.
export default function FilterPopover({ mode, uniqueValues, value, onChange }) {
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

  const active = value && ((value.type === 'set' && value.values?.length) || (value.type === 'text' && value.text))

  const selected = new Set(value?.type === 'set' ? value.values : [])

  const toggle = (v) => {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next.size ? { type: 'set', values: [...next] } : undefined)
  }

  const shown = (uniqueValues || []).filter((v) => (v || '(blank)').toLowerCase().includes(q.toLowerCase()))

  return (
    <span className="th-filter" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`th-filter-btn${active ? ' active' : ''}`}
        title="Filter"
        onClick={() => setOpen((o) => !o)}
      >
        <Filter size={12} />
      </button>
      {open && (
        <div className="filter-pop">
          {mode === 'set' ? (
            <>
              <div className="filter-search">
                <Search size={13} />
                <input autoFocus placeholder="Find value" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="filter-list">
                {shown.map((v) => (
                  <label key={v || '(blank)'} className="filter-opt">
                    <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)} />
                    <span>{v || '(blank)'}</span>
                  </label>
                ))}
                {shown.length === 0 && <div className="filter-empty">No matches</div>}
              </div>
            </>
          ) : (
            <input
              autoFocus
              className="filter-text"
              placeholder="Contains…"
              value={value?.text || ''}
              onChange={(e) => onChange(e.target.value ? { type: 'text', text: e.target.value } : undefined)}
            />
          )}
          <div className="filter-actions">
            <button className="btn" onClick={() => onChange(undefined)}>
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
