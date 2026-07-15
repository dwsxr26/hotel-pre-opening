import { useMemo } from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { aggregate } from '../../lib/serviceCalc'

const cells = (r) => (
  <>
    <td className="num">{formatMoney(r.budget)}</td>
    <td className="num">{formatMoney(r.spent)}</td>
    <td className="num">{formatMoney(r.reforecast)}</td>
    <td className="num">{formatMoney(r.remaining)}</td>
  </>
)

function MiniTable({ label, rows, subtotal, osne, grand }) {
  return (
    <div className="card overflow-hidden" style={{ flex: 1, minWidth: 320 }}>
      <div className="card-hd">By {label}</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="summary-table">
          <thead>
            <tr>
              <th>{label}</th>
              <th className="num">Budget</th>
              <th className="num">Spent</th>
              <th className="num">Reforecast</th>
              <th className="num">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                {cells(r)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="svc-subtotal-row"><td>Sub-Total Services</td>{cells(subtotal)}</tr>
            <tr><td>OS&amp;E Orders</td>{cells(osne)}</tr>
            <tr className="svc-total-row"><td>Total</td>{cells(grand)}</tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// Collapsible "Metrics" for the Overview tab: Services broken down by Department
// and by Owner, each footed with Sub-Total Services, an OS&E Orders line (pulled
// from the Orders items), and a combined Total.
export default function ServicesMetrics({ lines, entriesByLine, closesByLine, items = [], incl, open, onToggle, zoom = 1, onZoom }) {
  const { byDept, byOwner, totals } = useMemo(() => {
    const group = (keyFn) => {
      const groups = {}
      for (const l of lines) (groups[keyFn(l) || '—'] ||= []).push(l)
      return Object.entries(groups)
        .map(([name, ls]) => ({ name, ...aggregate(ls, entriesByLine, closesByLine, incl) }))
        .sort((a, b) => b.reforecast - a.reforecast)
    }
    return {
      byDept: group((l) => l.department),
      byOwner: group((l) => l.owner),
      totals: aggregate(lines, entriesByLine, closesByLine, incl),
    }
  }, [lines, entriesByLine, closesByLine, incl])

  // OS&E line pulled from the Orders items (ex-VAT): budget = locked per-line
  // budgets; spent = ordered/completed line totals; remaining = not-ordered.
  const osne = useMemo(() => {
    const lineTot = (r) => (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
    const budget = items.reduce((s, r) => s + (Number(r.budget) || 0), 0)
    const spent = items.filter((r) => r.status === 'Order placed' || r.status === 'Order complete').reduce((s, r) => s + lineTot(r), 0)
    const remaining = items.filter((r) => r.status === 'Not ordered').reduce((s, r) => s + lineTot(r), 0)
    return { budget, spent, remaining, reforecast: spent + remaining }
  }, [items])
  const grand = {
    budget: totals.budget + osne.budget,
    spent: totals.spent + osne.spent,
    reforecast: totals.reforecast + osne.reforecast,
    remaining: totals.remaining + osne.remaining,
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="metrics-hd">
        <button className="collapse-hd" onClick={onToggle} style={{ flex: 1 }}>
          <ChevronDown size={16} className={`collapse-chev ${open ? 'open' : ''}`} />
          <span className="card-hd" style={{ padding: 0, border: 0 }}>Metrics</span>
          <span className="collapse-hint">{formatMoney(totals.reforecast)} reforecast · {open ? 'Hide' : 'Show'}</span>
        </button>
        {open && onZoom && (
          <div className="zoomer" title="Zoom the metrics" onClick={(e) => e.stopPropagation()}>
            <button className="btn icon-btn" onClick={() => onZoom(-0.1)} disabled={zoom <= 0.6} aria-label="Zoom out"><Minus size={14} /></button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="btn icon-btn" onClick={() => onZoom(0.1)} disabled={zoom >= 1.3} aria-label="Zoom in"><Plus size={14} /></button>
          </div>
        )}
      </div>
      {open && (
        <div className="summary-pad" style={{ paddingTop: 0, display: 'flex', gap: 16, flexWrap: 'wrap', zoom }}>
          <MiniTable label="Department" rows={byDept} subtotal={totals} osne={osne} grand={grand} />
          <MiniTable label="Owner" rows={byOwner} subtotal={totals} osne={osne} grand={grand} />
        </div>
      )}
    </div>
  )
}
