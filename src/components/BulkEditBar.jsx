import { useState } from 'react'
import { X } from 'lucide-react'
import { DEPARTMENTS } from '../lib/departments'
import { STATUSES } from '../lib/constants'

// Appears when rows are selected. You set any of the fields (blank = leave
// unchanged) and click Apply; the parent confirms and writes the batch.
const NC = '' // "no change"

export default function BulkEditBar({
  count,
  filteredCount,
  allFilteredSelected,
  categories,
  people,
  suppliers,
  onApply,
  onClear,
  onSelectAllFiltered,
}) {
  const [fields, setFields] = useState({
    category: NC, owner: NC, department: NC, status: NC, supplier: NC, order_date: NC, est_arrival: NC,
  })

  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }))

  // Build a patch of only the fields the user actually chose.
  const buildPatch = () => {
    const patch = {}
    for (const [k, v] of Object.entries(fields)) {
      if (v === NC || v === '') continue
      patch[k] = v
    }
    return patch
  }

  const apply = () => {
    const patch = buildPatch()
    if (Object.keys(patch).length === 0) return
    onApply(patch)
  }

  return (
    <div className="bulkbar">
      <div className="bulkbar-lead">
        <strong>{count} selected</strong>
        {!allFilteredSelected && filteredCount > count && (
          <button className="linkbtn" onClick={onSelectAllFiltered}>
            Select all {filteredCount} filtered
          </button>
        )}
      </div>

      <div className="bulkbar-fields">
        <select className="ctrl" value={fields.category} onChange={(e) => set('category', e.target.value)}>
          <option value={NC}>Category…</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="ctrl" value={fields.owner} onChange={(e) => set('owner', e.target.value)}>
          <option value={NC}>Owner…</option>
          <option value="__unassign">Unassigned</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="ctrl" value={fields.department} onChange={(e) => set('department', e.target.value)}>
          <option value={NC}>Department…</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="ctrl" value={fields.status} onChange={(e) => set('status', e.target.value)}>
          <option value={NC}>Status…</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className="ctrl" list="bulk-suppliers" placeholder="Supplier…"
          value={fields.supplier} onChange={(e) => set('supplier', e.target.value)}
        />
        <datalist id="bulk-suppliers">
          {suppliers.map((s) => <option key={s} value={s} />)}
        </datalist>
        <label className="bulk-date">Order date
          <input className="ctrl" type="date" value={fields.order_date} onChange={(e) => set('order_date', e.target.value)} />
        </label>
        <label className="bulk-date">Est. arrival
          <input className="ctrl" type="date" value={fields.est_arrival} onChange={(e) => set('est_arrival', e.target.value)} />
        </label>
      </div>

      <div className="bulkbar-actions">
        <button className="btn btn-primary" onClick={apply}>Apply to {count}</button>
        <button className="btn icon-btn" title="Clear selection" onClick={onClear}><X size={16} /></button>
      </div>
    </div>
  )
}
