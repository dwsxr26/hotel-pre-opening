import { useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { computeLine } from '../../lib/serviceCalc'

// Admin panel to approve an over-budget (overspend) invoice. Two routes:
//   1. 'reallocated' — cut budget from other lines; the total is reallocated onto
//      the over-budget line. Each target shows budget/spent/reforecast/remaining,
//      updating live; cutting a line below its own reforecast is blocked.
//   2. 'accepted' — a true overspend, with a written reason.
const newKey = () => `r-${crypto.randomUUID()}`

export default function OverspendApprovalPanel({
  line, monthLabel, overspend, lines, entriesByLine, closesByLine, onApprove, onClose,
}) {
  const [tab, setTab] = useState('reallocated')
  const [rows, setRows] = useState([{ key: newKey(), line_id: '', amount: '' }])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [notify, setNotify] = useState(null) // post-save reminder list

  // Figures for a candidate line (ex VAT), for the live budget/spent/etc. display.
  const figures = useMemo(() => {
    const map = {}
    for (const l of lines) map[l.id] = computeLine(l, entriesByLine[l.id], closesByLine[l.id], false)
    return map
  }, [lines, entriesByLine, closesByLine])

  const chosen = new Set(rows.map((r) => r.line_id).filter(Boolean))
  const options = lines
    .filter((l) => l.id !== line.id)
    .sort((a, b) => a.name.localeCompare(b.name))

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { key: newKey(), line_id: '', amount: '' }])
  const removeRow = (key) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))

  const valid = rows
    .filter((r) => r.line_id && Number(r.amount) > 0)
    .map((r) => ({ line_id: r.line_id, amount: Math.round(Number(r.amount)) }))
  const total = valid.reduce((s, r) => s + r.amount, 0)
  const remaining = Math.max(0, Math.round(overspend) - total)

  // A cut that pushes a target line below its own reforecast is not allowed.
  const overcut = rows.some((r) => {
    if (!r.line_id || !(Number(r.amount) > 0)) return false
    const f = figures[r.line_id]
    return f && (Number(f.budget) - Number(r.amount)) < f.reforecast - 0.5
  })

  const canReallocate = total > 0 && !overcut
  const canAccept = note.trim().length > 0

  const doApprove = async (method) => {
    if (saving) return
    setSaving(true)
    try {
      if (method === 'reallocated') {
        await onApprove('reallocated', note.trim(), valid)
        // Build the "tell the owners" reminder before closing.
        setNotify(valid.map((r) => {
          const l = lines.find((x) => x.id === r.line_id)
          return { name: l?.name || '—', owner: l?.owner || 'Unassigned', amount: r.amount }
        }))
      } else {
        await onApprove('accepted', note.trim(), [])
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  // A plain render function (NOT a nested component) so the inputs keep focus
  // between keystrokes.
  const renderRow = (r) => {
    const f = r.line_id ? figures[r.line_id] : null
    const amt = Number(r.amount) || 0
    const newBudget = f ? Number(f.budget) - amt : 0
    const bad = f && newBudget < f.reforecast - 0.5
    return (
      <div className="ovp-row" key={r.key}>
        <select
          className="ovp-line" value={r.line_id}
          onChange={(e) => setRow(r.key, { line_id: e.target.value })}
        >
          <option value="">Select a line to reduce…</option>
          {options
            .filter((l) => l.id === r.line_id || !chosen.has(l.id))
            .map((l) => <option key={l.id} value={l.id}>{l.name} · {l.department}</option>)}
        </select>
        <input
          className="ovp-amt" type="number" step="any" placeholder="Reduce by"
          value={r.amount} onChange={(e) => setRow(r.key, { amount: e.target.value })}
        />
        <button className="me-x" title="Remove" onClick={() => removeRow(r.key)}><Trash2 size={13} /></button>
        {f && (
          <div className={`ovp-figs ${bad ? 'ovp-bad' : ''}`}>
            <span>Budget <b>{formatMoney(f.budget)}{amt ? ` → ${formatMoney(newBudget)}` : ''}</b></span>
            <span>Spent <b>{formatMoney(f.spent)}</b></span>
            <span>Reforecast <b>{formatMoney(f.reforecast)}</b></span>
            <span>Remaining <b>{formatMoney(f.remaining)}</b></span>
            {bad && <span className="ovp-warn">Cut exceeds this line's own headroom — it would go over budget.</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="modal ovp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close"><X size={18} /></button>
        <h3>Approve overspend</h3>
        <p>{line.name} · {line.department} · {monthLabel}</p>
        <div className="me-warn">Overspend to approve: <b>{formatMoney(overspend)}</b> ex VAT</div>

        {notify ? (
          <div className="ovp-notify">
            <div className="me-status">Approved. Please tell the owners of the reduced lines about the change:</div>
            <ul className="ovp-notify-list">
              {notify.map((n, i) => (
                <li key={i}><b>{n.owner}</b> — {n.name} reduced by {formatMoney(n.amount)}</li>
              ))}
            </ul>
            <div className="me-close-actions">
              <div className="spacer" />
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="seg ovp-seg">
              <button className={`seg-btn ${tab === 'reallocated' ? 'on' : ''}`} onClick={() => setTab('reallocated')}>Reduce budget elsewhere</button>
              <button className={`seg-btn ${tab === 'accepted' ? 'on' : ''}`} onClick={() => setTab('accepted')}>Accept overspend</button>
            </div>

            {tab === 'reallocated' ? (
              <>
                <div className="ovp-rows">
                  {rows.map((r) => renderRow(r))}
                </div>
                <button className="btn me-add" onClick={addRow}><Plus size={13} /> Add another line</button>
                <div className="ovp-tally">
                  <span>Reducing <b>{formatMoney(total)}</b></span>
                  <span className={remaining > 0.5 ? 'ovp-warn' : ''}>
                    {remaining > 0.5 ? `${formatMoney(remaining)} of the overspend not yet covered` : 'Overspend fully covered'}
                  </span>
                </div>
                <textarea
                  className="ovp-note" placeholder="Optional note…"
                  value={note} onChange={(e) => setNote(e.target.value)}
                />
                <div className="me-close-actions">
                  <div className="spacer" />
                  <button className="btn" disabled={saving} onClick={onClose}>Cancel</button>
                  <button className="btn btn-primary" disabled={saving || !canReallocate} onClick={() => doApprove('reallocated')}>
                    Approve &amp; reallocate
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="me-status">This is a true overspend not recovered by reducing budget elsewhere. Explain why:</div>
                <textarea
                  className="ovp-note" placeholder="Reason for accepting the overspend…"
                  value={note} onChange={(e) => setNote(e.target.value)}
                />
                <div className="me-close-actions">
                  <div className="spacer" />
                  <button className="btn" disabled={saving} onClick={onClose}>Cancel</button>
                  <button className="btn btn-primary" disabled={saving || !canAccept} onClick={() => doApprove('accepted')}>
                    Approve overspend
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
