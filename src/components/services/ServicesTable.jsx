import { useEffect, useMemo, useRef } from 'react'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { GripVertical } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS, isPastMonth, computeLine } from '../../lib/serviceCalc'

const INFO_COLS = [
  { id: 'line', header: 'Line', size: 260 },
  { id: 'department', header: 'Department', size: 130 },
  { id: 'owner', header: 'Owner', size: 120 },
  { id: 'budget', header: 'Budget', size: 110, num: true },
  { id: 'spent', header: 'Spent', size: 110, num: true },
  { id: 'reforecast', header: 'Reforecast', size: 120, num: true },
  { id: 'remaining', header: 'Remaining', size: 120, num: true },
]
const INFO_IDS = INFO_COLS.map((c) => c.id)
const MONTH_COLS = SERVICE_MONTHS.map((m) => ({ id: `m:${m.key}`, header: m.label, size: 96, num: true, month: m.key }))
const ALL_COLS = [...INFO_COLS, ...MONTH_COLS]
const DEFAULT_ORDER = ALL_COLS.map((c) => c.id)

// Services grid: info columns (Line…Remaining) are pinned, resizable and
// reorderable; the 33 month columns scroll. Clicking a month cell opens the
// entry editor. Read figures come from computeLine (VAT-aware).
export default function ServicesTable({ lines, entriesByLine, closesByLine, incl, view, setView, onOpenMonth }) {
  const scrollRef = useRef(null)
  const didScroll = useRef(false)

  const calc = useMemo(() => {
    const map = {}
    for (const l of lines) map[l.id] = computeLine(l, entriesByLine[l.id], closesByLine[l.id], incl)
    return map
  }, [lines, entriesByLine, closesByLine, incl])

  const columns = useMemo(() => ALL_COLS.map((c) => ({ id: c.id, header: c.header, size: c.size })), [])

  const effectiveOrder = useMemo(() => {
    const saved = view.columnOrder?.length ? view.columnOrder : DEFAULT_ORDER
    const known = saved.filter((id) => DEFAULT_ORDER.includes(id))
    const missing = DEFAULT_ORDER.filter((id) => !known.includes(id))
    return [...known, ...missing]
  }, [view.columnOrder])

  const table = useReactTable({
    data: lines,
    columns,
    state: {
      columnSizing: view.columnSizing || {},
      columnOrder: effectiveOrder,
      columnPinning: { left: INFO_IDS },
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    onColumnSizingChange: (u) =>
      setView((p) => ({ columnSizing: typeof u === 'function' ? u(p.columnSizing || {}) : u })),
    getCoreRowModel: getCoreRowModel(),
  })

  // Default the horizontal scroll to Jul-26 (first forecast month); user can
  // scroll left for the historicals. Runs once after data loads.
  useEffect(() => {
    if (didScroll.current || lines.length === 0 || !scrollRef.current) return
    const el = scrollRef.current.querySelector('th[data-month="2026-07-01"]')
    if (!el) return
    const pinnedW = INFO_IDS.reduce((s, id) => s + (table.getColumn(id)?.getSize() ?? 0), 0)
    scrollRef.current.scrollLeft = el.offsetLeft - pinnedW
    didScroll.current = true
  }, [lines, table])

  const leaf = table.getVisibleLeafColumns()
  const meta = (id) => ALL_COLS.find((c) => c.id === id) || {}

  const cellContent = (colId, line) => {
    const c = calc[line.id]
    const m = meta(colId)
    if (colId === 'line') return line.name
    if (colId === 'department') return line.department
    if (colId === 'owner') return line.owner || '—'
    if (colId === 'budget') return formatMoney(c.budget)
    if (colId === 'spent') return formatMoney(c.spent)
    if (colId === 'reforecast') return formatMoney(c.reforecast)
    if (colId === 'remaining') return formatMoney(c.remaining)
    if (m.month) {
      const mv = c.monthly[m.month]
      return mv.effective ? formatMoney(mv.effective) : '-'
    }
    return null
  }

  const reorder = (from, to) => {
    if (!INFO_IDS.includes(from) || !INFO_IDS.includes(to) || from === to) return
    const order = [...effectiveOrder]
    order.splice(order.indexOf(to), 0, order.splice(order.indexOf(from), 1)[0])
    setView({ columnOrder: order })
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
            {leaf.map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {table.getHeaderGroups()[0].headers.map((header) => {
                const col = header.column
                const pinned = col.getIsPinned() === 'left'
                const m = meta(col.id)
                const isInfo = INFO_IDS.includes(col.id)
                const style = pinned ? { left: col.getStart('left'), zIndex: 7 } : undefined
                const last = col.id === INFO_IDS[INFO_IDS.length - 1]
                return (
                  <th
                    key={col.id}
                    data-month={m.month || undefined}
                    className={`${pinned ? 'pinned' : ''} ${last ? 'pinned-shadow' : ''} ${m.num ? 'cell-num' : ''} ${m.month && isPastMonth(m.month) ? 'svc-past' : ''}`}
                    style={style}
                    onDragOver={(e) => isInfo && e.preventDefault()}
                    onDrop={(e) => {
                      if (!isInfo) return
                      reorder(e.dataTransfer.getData('text/plain'), col.id)
                    }}
                  >
                    <div className="svc-th">
                      {isInfo && (
                        <span
                          className="th-grip" draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', col.id)
                          }}
                          title="Drag to reorder"
                        >
                          <GripVertical size={12} />
                        </span>
                      )}
                      <span className="svc-th-label">{col.columnDef.header}</span>
                    </div>
                    {col.getCanResize() && (
                      <span
                        className={`resizer ${col.getIsResizing() ? 'active' : ''}`}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const line = row.original
              const c = calc[line.id]
              return (
                <tr key={line.id}>
                  {leaf.map((col) => {
                    const pinned = col.getIsPinned() === 'left'
                    const m = meta(col.id)
                    const last = col.id === INFO_IDS[INFO_IDS.length - 1]
                    const style = pinned ? { left: col.getStart('left'), zIndex: 6 } : undefined
                    const over = col.id === 'reforecast' && c.reforecast > c.budget + 0.5
                    if (m.month) {
                      const mv = c.monthly[m.month]
                      return (
                        <td
                          key={col.id}
                          className={`cell-num svc-month ${isPastMonth(m.month) ? 'svc-past' : ''} ${mv.closed ? 'svc-closed' : ''}`}
                        >
                          <button className="svc-cell-btn" onClick={() => onOpenMonth(line, m.month)}>
                            {mv.effective ? formatMoney(mv.effective) : '-'}
                          </button>
                        </td>
                      )
                    }
                    return (
                      <td
                        key={col.id}
                        className={`${pinned ? 'pinned' : ''} ${last ? 'pinned-shadow' : ''} ${m.num ? 'cell-num' : ''} ${over ? 'svc-over' : ''}`}
                        style={style}
                      >
                        <span className="cell-pad" title={col.id === 'line' ? line.name : undefined}>
                          {cellContent(col.id, line)}
                        </span>
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
