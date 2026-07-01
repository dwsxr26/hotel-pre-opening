import { useMemo } from 'react'
import { STATUS_CLASS, STATUS_COLOR, STATUSES } from '../lib/constants'
import { formatInt } from '../lib/format'

// "Line items by status" — a badge, count/percentage, and a proportional
// coloured bar per status. Reused on the Orders tab and both Summary tabs.
// `rows` is a plain array of item objects (whatever set you want summarised).
export default function StatusBars({ rows, title = 'Line items by status', grid = false }) {
  const counts = useMemo(() => {
    const b = Object.fromEntries(STATUSES.map((s) => [s, 0]))
    for (const r of rows) b[r.status] = (b[r.status] || 0) + 1
    return b
  }, [rows])

  const total = rows.length

  return (
    <div>
      {title && <div className="card-hd" style={{ padding: 0, border: 0, marginBottom: 12 }}>{title}</div>}
      <div className={grid ? 'statusbars-grid' : ''}>
        {STATUSES.map((s) => {
        const n = counts[s] || 0
        const pct = total ? Math.round((n / total) * 100) : 0
        return (
          <div key={s} className="statusbar">
            <div className="statusbar-top">
              <span className={`badge ${STATUS_CLASS[s]}`}>
                <span className="dot" />
                {s}
              </span>
              <span className="statusbar-count">
                {formatInt(n)} <span className="statusbar-pct">({pct}%)</span>
              </span>
            </div>
            <div className="statusbar-track">
              <div className="statusbar-fill" style={{ width: `${pct}%`, background: STATUS_COLOR[s] }} />
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
