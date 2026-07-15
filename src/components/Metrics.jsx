import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatInt, formatMoney, lineTotal } from '../lib/format'
import StatusBars from './StatusBars'

// Collapsible "Metrics" panel: the top-line KPI stats plus the line-items-by-
// status bars, over the whole list. Collapsed by default.
export default function Metrics({ items, open, onToggle }) {
  const kpi = useMemo(() => {
    const total = items.length
    const budget = items.reduce((s, r) => s + (Number(r.budget) || 0), 0)
    const ordered = items
      .filter((r) => r.status === 'Order placed' || r.status === 'Order complete')
      .reduce((s, r) => s + lineTotal(r), 0)
    const remaining = items
      .filter((r) => r.status === 'Not ordered')
      .reduce((s, r) => s + lineTotal(r), 0)
    return { total, budget, ordered, remaining }
  }, [items])

  const cards = [
    { label: 'Budget', value: formatMoney(kpi.budget), hint: 'sum of Budget column' },
    { label: 'Ordered', value: formatMoney(kpi.ordered), hint: 'placed or complete' },
    { label: 'Remaining', value: formatMoney(kpi.remaining), hint: 'not yet ordered' },
    { label: 'Line items', value: formatInt(kpi.total), hint: 'across all packages' },
  ]

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button className="collapse-hd" onClick={onToggle}>
        <ChevronDown size={16} className={`collapse-chev ${open ? 'open' : ''}`} />
        <span className="card-hd" style={{ padding: 0, border: 0 }}>Metrics</span>
        <span className="collapse-hint">
          Budget {formatMoney(kpi.budget)} · Ordered {formatMoney(kpi.ordered)} · Remaining {formatMoney(kpi.remaining)} · {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div className="summary-pad" style={{ paddingTop: 0 }}>
          <div className="kpis">
            {cards.map((c) => (
              <div key={c.label} className="kpi-card">
                <div className="kpi-label">{c.label}</div>
                <div className="kpi-value">{c.value}</div>
                <div className="kpi-hint">{c.hint}</div>
              </div>
            ))}
          </div>
          <StatusBars rows={items} grid />
        </div>
      )}
    </div>
  )
}
