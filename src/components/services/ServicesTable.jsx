import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS, isPastMonth, computeLine } from '../../lib/serviceCalc'

// Hand-rolled sticky grid: the 7 info columns are pinned (fixed on horizontal
// scroll), resizable and drag-reorderable; the 33 month columns scroll. Offsets
// come from state (not measured), so scrolling never affects widths.
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

export default function ServicesTable({ lines, entriesByLine, closesByLine, incl, view, setView, onOpenMonth, isAdmin, people, onLineUpdate }) {
  const [drag, setDrag] = useState(null) // live resize: { id, w }
  const [dragCol, setDragCol] = useState(null)
  const scrollRef = useRef(null)
  const didScroll = useRef(false)

  // Default the horizontal scroll to Jul-26 (first forecast month); scroll left
  // for history. Runs once after data loads.
  useEffect(() => {
    if (didScroll.current || lines.length === 0 || !scrollRef.current) return
    const idx = SERVICE_MONTHS.findIndex((m) => m.key === '2026-07-01')
    if (idx > 0) scrollRef.current.scrollLeft = idx * MONTH_W
    didScroll.current = true
  }, [lines])

  const calc = useMemo(() => {
    const map = {}
    for (const l of lines) map[l.id] = computeLine(l, entriesByLine[l.id], closesByLine[l.id], incl)
    return map
  }, [lines, entriesByLine, closesByLine, incl])

  const infoOrder = useMemo(() => {
    const saved = view.svcOrder
    if (saved && saved.length === INFO_IDS.length && INFO_IDS.every((id) => saved.includes(id))) return saved
    return INFO_IDS
  }, [view.svcOrder])

  const width = (id) => {
    if (drag && drag.id === id) return drag.w
    return view.svcWidths?.[id] ?? INFO_DEFS.find((d) => d.id === id)?.w ?? MONTH_W
  }

  // Cumulative left offsets for the pinned info columns (recomputed each render
  // so a live resize shifts the columns to its right).
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
    const move = (ev) => {
      latest = Math.max(80, startW + (ev.clientX - startX))
      setDrag({ id, w: latest })
    }
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

  const infoCell = (id, line, c) => {
    if (id === 'line') return <span className="cell-pad" title={line.name}>{line.name}</span>
    if (id === 'department') return <span className="cell-pad">{line.department}</span>
    if (id === 'owner') {
      if (!isAdmin) return <span className="cell-pad">{line.owner || '—'}</span>
      const opts = line.owner && !people.includes(line.owner) ? [line.owner, ...people] : people
      return (
        <select
          className="cell-input" value={line.owner || ''}
          onChange={(e) => onLineUpdate(line.id, { owner: e.target.value })}
        >
          <option value="">Unassigned</option>
          {opts.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )
    }
    if (id === 'budget') {
      if (!isAdmin) return <span className="cell-pad cell-num">{formatMoney(c.budget)}</span>
      return (
        <input
          key={line.budget} className="cell-input cell-num" type="number" step="any" defaultValue={line.budget}
          title="Budget (ex VAT)"
          onBlur={(e) => {
            const v = Number(e.target.value) || 0
            if (v !== Number(line.budget)) onLineUpdate(line.id, { budget: v })
          }}
        />
      )
    }
    if (id === 'spent') return <span className="cell-pad cell-num">{formatMoney(c.spent)}</span>
    if (id === 'reforecast') return <span className="cell-pad cell-num">{formatMoney(c.reforecast)}</span>
    if (id === 'remaining') return <span className="cell-pad cell-num">{formatMoney(c.remaining)}</span>
    return null
  }

  if (lines.length === 0) {
    return (
      <div className="card">
        <div className="center-note">
          No service lines yet. Run migration <code>0007_services.sql</code> then <code>npm run seed:services</code>.
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="table-scroll" ref={scrollRef}>
        <table className="grid svc-grid">
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
                    className={`pinned ${last ? 'pinned-shadow' : ''} ${c.num ? 'cell-num' : ''} ${dragCol === c.id ? 'drag-source' : ''}`}
                    style={{ left: lefts[c.id], zIndex: 8 }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(c.id)}
                  >
                    <div className="svc-th">
                      <span
                        className="th-grip" draggable
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragCol(c.id) }}
                        onDragEnd={() => setDragCol(null)}
                        title="Drag to reorder"
                      >
                        <GripVertical size={12} />
                      </span>
                      <span className="svc-th-label">{c.label}</span>
                    </div>
                    <span className="resizer" onMouseDown={(e) => startResize(c.id, e)} />
                  </th>
                )
              })}
              {SERVICE_MONTHS.map((m) => (
                <th key={m.key} data-month={m.key} className={`cell-num svc-month ${isPastMonth(m.key) ? 'svc-past' : ''}`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const c = calc[line.id]
              const over = c.reforecast > c.budget + 0.5
              return (
                <tr key={line.id}>
                  {infoCols.map((ic) => {
                    const last = ic.id === infoOrder[infoOrder.length - 1]
                    return (
                      <td
                        key={ic.id}
                        className={`pinned ${last ? 'pinned-shadow' : ''} ${ic.num ? 'cell-num' : ''} ${ic.id === 'reforecast' && over ? 'svc-over' : ''}`}
                        style={{ left: lefts[ic.id], zIndex: 6 }}
                      >
                        {infoCell(ic.id, line, c)}
                      </td>
                    )
                  })}
                  {SERVICE_MONTHS.map((m) => {
                    const mv = c.monthly[m.key]
                    return (
                      <td
                        key={m.key}
                        className={`cell-num svc-month ${isPastMonth(m.key) ? 'svc-past' : ''} ${mv.closed ? 'svc-closed' : ''}`}
                      >
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
        </table>
      </div>
    </div>
  )
}
