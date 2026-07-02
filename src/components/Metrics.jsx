import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatInt, formatMoney, lineTotal } from '../lib/format'
import StatusBars from './StatusBars'

// Collapsible "Metrics" panel: the top-line KPI stats plus the line-items-by-
// status bars, over the whole list. Collapsed by default.
export default function Metrics({ items, open, onToggle }) {
  const kpi = useMemo(() => {
    const total = items.length
    const value = items.reduce((s, r) => s + lineTotal(r), 0)
    const arrived = items.filter((r) => r.status === 'Order arrived').length
    const allocated = items.filter((r) => r.owner).length
    return { total, value, arrived, allocated }
  }, [items])

  const cards = [
    { label: 'Line items', value: formatInt(kpi.total), hint: 'across all packages' },
    { label: 'Total value', value: formatMoney(kpi.value), hint: 'qty × unit price' },
    {
      label: 'Arrived',
      value: formatInt(kpi.arrived),
      hint: kpi.total ? `${Math.round((kpi.arrived / kpi.total) * 100)}% of items` : '—',
    },
    {
      label: 'Allocated',
      value: formatInt(kpi.allocated),
      hint: kpi.total ? `${Math.round((kpi.allocated / kpi.total) * 100)}% has an owner` : '—',
    },
  ]

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button className="collapse-hd" onClick={onToggle}>
        <ChevronDown size={16} className={`collapse-chev ${open ? 'open' : ''}`} />
        <span className="card-hd" style={{ padding: 0, border: 0 }}>Metrics</span>
        <span className="collapse-hint">{open ? 'Hide' : 'Show'}</span>
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
