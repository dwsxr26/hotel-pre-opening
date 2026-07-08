import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS, isPastMonth } from '../../lib/serviceCalc'

const INFO_DEFS = [
  { id: 'line', label: 'Line', w: 260 },
  { id: 'department', label: 'Department', w: 130 },
  { id: 'owner', label: 'Owner', w: 130 },
  { id: 'budget', label: 'Budget', w: 110, num: true },
  { id: 'spent', label: 'Spent', w: 110, num: true },
  { id: 'reforecast', label: 'Reforecast', w: 120, num: true },
  { id: 'remaining', label: 'Remaining', w: 120, num: true },
]
const INFO_IDS = INFO_DEFS.map((d) => d.id)
const MONTH_W = 96
const clampW = (w) => Math.max(80, Math.min(500, w))

// Line name: text; admins click to edit.
function NameCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  if (!editing) {
    return (
      <span className="cell-pad editable" title={`${value} — click to edit`} onClick={() => { setV(value); setEditing(true) }}>
        {value}
      </span>
    )
  }
  return (
    <input
      className="cell-input" autoFocus value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEditing(false); const t = v.trim(); if (t && t !== value) onCommit(t) }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

// Budget: formatted display; admins click to edit (ex-VAT).
function BudgetCell({ valueEx, display, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(valueEx)
  if (!editing) {
    return (
      <span className="cell-pad cell-num editable" title="Click to edit budget" onClick={() => { setV(valueEx); setEditing(true) }}>
        {display}
      </span>
    )
  }
  return (
    <input
      className="cell-input cell-num" type="number" step="any" autoFocus value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEditing(false); const n = Number(v) || 0; if (n !== Number(valueEx)) onCommit(n) }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

export default function ServicesTable({ rows, totals, sort, onSortToggle, view, setView, onOpenMonth, isAdmin, people, onLineUpdate, zoom = 1 }) {
  const [drag, setDrag] = useState(null) // live resize { id, w }
  const [dragCol, setDragCol] = useState(null)
  const scrollRef = useRef(null)
  const didScroll = useRef(false)

  useEffect(() => {
    if (didScroll.current || rows.length === 0 || !scrollRef.current) return
    const el = scrollRef.current
    const idx = SERVICE_MONTHS.findIndex((m) => m.key === '2026-07-01')
    didScroll.current = true
    if (idx <= 0) return
    // Defer until the table has laid out, else scrollLeft gets clamped to a
    // not-yet-wide-enough scrollWidth. Target = the Jul-26 column's natural x
    // minus the pinned block, which equals idx * month width.
    requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollLeft = idx * MONTH_W * (zoom || 1) }))
  }, [rows, zoom])

  const infoOrder = useMemo(() => {
    const saved = view.svcOrder
    if (saved && saved.length === INFO_IDS.length && INFO_IDS.every((id) => saved.includes(id))) return saved
    return INFO_IDS
  }, [view.svcOrder])

  const width = (id) => {
    if (drag && drag.id === id) return drag.w
    return clampW(view.svcWidths?.[id] ?? INFO_DEFS.find((d) => d.id === id)?.w ?? MONTH_W)
  }

  const infoCols = infoOrder.map((id) => ({ ...INFO_DEFS.find((d) => d.id === id), w: width(id) }))
  let acc = 0
  const lefts = {}
  for (const c of infoCols) {
    lefts[c.id] = acc
    acc += c.w
  }

  const startResize = (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = width(id)
    let latest = startW
    const move = (ev) => { latest = Math.max(80, startW + (ev.clientX - startX)); setDrag({ id, w: latest }) }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setView({ svcWidths: { ...(view.svcWidths || {}), [id]: latest } })
      setDrag(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onDrop = (targetId) => {
    if (!dragCol || dragCol === targetId) return setDragCol(null)
    const order = [...infoOrder]
    order.splice(order.indexOf(targetId), 0, order.splice(order.indexOf(dragCol), 1)[0])
    setView({ svcOrder: order })
    setDragCol(null)
  }

  const sortIcon = (key) => {
    if (sort.key !== key) return <ChevronsUpDown size={12} opacity={0.4} />
    return sort.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
  }

  const infoCell = (id, line, c) => {
    if (id === 'line') {
      if (!isAdmin) return <span className="cell-pad" title={line.name}>{line.name}</span>
      return <NameCell value={line.name} onCommit={(v) => onLineUpdate(line.id, { name: v })} />
    }
    if (id === 'department') return <span className="cell-pad">{line.department}</span>
    if (id === 'owner') {
      if (!isAdmin) return <span className="cell-pad">{line.owner || '—'}</span>
      const opts = line.owner && !people.includes(line.owner) ? [line.owner, ...people] : people
      return (
        <select className="cell-input" value={line.owner || ''} onChange={(e) => onLineUpdate(line.id, { owner: e.target.value })}>
          <option value="">Unassigned</option>
          {opts.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )
    }
    if (id === 'budget') {
      if (!isAdmin) return <span className="cell-pad cell-num">{formatMoney(c.budget)}</span>
      return <BudgetCell valueEx={line.budget} display={formatMoney(c.budget)} onCommit={(v) => onLineUpdate(line.id, { budget: v })} />
    }
    if (id === 'spent') return <span className="cell-pad cell-num">{formatMoney(c.spent)}</span>
    if (id === 'reforecast') return <span className="cell-pad cell-num">{formatMoney(c.reforecast)}</span>
    if (id === 'remaining') return <span className="cell-pad cell-num">{formatMoney(c.remaining)}</span>
    return null
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="center-note">No service lines match the current filters.</div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="table-scroll" ref={scrollRef}>
        <table className="grid svc-grid" style={{ zoom }}>
          <colgroup>
            {infoCols.map((c) => <col key={c.id} style={{ width: c.w }} />)}
            {SERVICE_MONTHS.map((m) => <col key={m.key} style={{ width: MONTH_W }} />)}
          </colgroup>
          <thead>
            <tr>
              {infoCols.map((c) => {
                const last = c.id === infoOrder[infoOrder.length - 1]
                return (
                  <th
                    key={c.id}
                    className={`pinned ${last ? 'pinned-shadow' : ''} ${c.num ? 'cell-num' : ''} ${dragCol === c.id ? 'drag-source' : ''} sortable`}
                    style={{ left: lefts[c.id], width: c.w, minWidth: c.w, maxWidth: c.w, zIndex: 8 }}
                    onClick={() => onSortToggle(c.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(c.id)}
                  >
                    <div className="svc-th">
                      <span
                        className="th-grip" draggable
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragCol(c.id) }}
                        onDragEnd={() => setDragCol(null)}
                        title="Drag to reorder"
                      >
                        <GripVertical size={12} />
                      </span>
                      <span className="svc-th-label">{c.label}</span>
                      <span className="svc-sort">{sortIcon(c.id)}</span>
                    </div>
                    <span className="resizer" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => startResize(c.id, e)} />
                  </th>
                )
              })}
              {SERVICE_MONTHS.map((m) => (
                <th
                  key={m.key} data-month={m.key}
                  className={`svc-month sortable ${isPastMonth(m.key) ? 'svc-past' : ''}`}
                  onClick={() => onSortToggle(`m:${m.key}`)}
                >
                  <span className="svc-month-label">{m.label} {sortIcon(`m:${m.key}`)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, c }) => {
              const over = c.reforecast > c.budget + 0.5
              return (
                <tr key={line.id}>
                  {infoCols.map((ic) => {
                    const last = ic.id === infoOrder[infoOrder.length - 1]
                    return (
                      <td
                        key={ic.id}
                        className={`pinned ${last ? 'pinned-shadow' : ''} ${ic.num ? 'cell-num' : ''} ${ic.id === 'reforecast' && over ? 'svc-over' : ''}`}
                        style={{ left: lefts[ic.id], width: ic.w, minWidth: ic.w, maxWidth: ic.w, zIndex: 6 }}
                      >
                        {infoCell(ic.id, line, c)}
                      </td>
                    )
                  })}
                  {SERVICE_MONTHS.map((m) => {
                    const mv = c.monthly[m.key]
                    return (
                      <td key={m.key} className={`cell-num svc-month ${isPastMonth(m.key) ? 'svc-past' : ''} ${mv.closed ? 'svc-closed' : ''}`}>
                        <button className="svc-cell-btn" onClick={() => onOpenMonth(line, m.key)}>
                          {mv.effective ? formatMoney(mv.effective) : '-'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="svc-total">
              {infoCols.map((ic) => {
                const last = ic.id === infoOrder[infoOrder.length - 1]
                const content = ic.id === 'line' ? 'Total' : ic.num ? formatMoney(totals[ic.id]) : ''
                return (
                  <td
                    key={ic.id}
                    className={`pinned ${last ? 'pinned-shadow' : ''} ${ic.num ? 'cell-num' : ''}`}
                    style={{ left: lefts[ic.id], width: ic.w, minWidth: ic.w, maxWidth: ic.w, bottom: 0, zIndex: 7 }}
                  >
                    <span className="cell-pad">{content}</span>
                  </td>
                )
              })}
              {SERVICE_MONTHS.map((m) => (
                <td key={m.key} className={`cell-num svc-month ${isPastMonth(m.key) ? 'svc-past' : ''}`} style={{ bottom: 0, zIndex: 3 }}>
                  <span className="cell-pad">{formatMoney(totals.months[m.key])}</span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
