import { useMemo } from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { aggregate } from '../../lib/serviceCalc'

function MiniTable({ label, rows, totals }) {
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
                <td className="num">{formatMoney(r.budget)}</td>
                <td className="num">{formatMoney(r.spent)}</td>
                <td className={`num ${r.reforecast > r.budget + 0.5 ? 'svc-over' : ''}`}>{formatMoney(r.reforecast)}</td>
                <td className="num">{formatMoney(r.remaining)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="svc-total-row">
              <td>Total</td>
              <td className="num">{formatMoney(totals.budget)}</td>
              <td className="num">{formatMoney(totals.spent)}</td>
              <td className="num">{formatMoney(totals.reforecast)}</td>
              <td className="num">{formatMoney(totals.remaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

const OSNE_BUDGET = 165000

// Collapsible "Metrics" for the Overview tab: a programme summary (OS&E +
// Services) plus the Services breakdown by Department and by Owner.
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

  // Programme summary (always ex-VAT). OS&E pulls from the Orders items:
  // spent = placed/complete lines, remaining = not-ordered lines.
  const programme = useMemo(() => {
    const lineTot = (r) => (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
    const osneSpent = items.filter((r) => r.status === 'Order placed' || r.status === 'Order complete').reduce((s, r) => s + lineTot(r), 0)
    const osneRemaining = items.filter((r) => r.status === 'Not ordered').reduce((s, r) => s + lineTot(r), 0)
    const svc = aggregate(lines, entriesByLine, closesByLine, false)
    const osne = { name: 'OS&E', budget: OSNE_BUDGET, spent: osneSpent, remaining: osneRemaining }
    const services = { name: 'Services', budget: svc.budget, spent: svc.spent, remaining: svc.remaining }
    const total = {
      name: 'Total',
      budget: osne.budget + services.budget,
      spent: osne.spent + services.spent,
      remaining: osne.remaining + services.remaining,
    }
    return { osne, services, total }
  }, [items, lines, entriesByLine, closesByLine])

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
        <div className="summary-pad" style={{ paddingTop: 0, zoom }}>
          <div className="card overflow-hidden" style={{ marginBottom: 16 }}>
            <div className="card-hd">Programme summary (ex VAT)</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="summary-table">
                <thead>
                  <tr><th>Area</th><th className="num">Budget</th><th className="num">Spent</th><th className="num">Remaining</th></tr>
                </thead>
                <tbody>
                  {[programme.osne, programme.services].map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="num">{formatMoney(r.budget)}</td>
                      <td className="num">{formatMoney(r.spent)}</td>
                      <td className="num">{formatMoney(r.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="svc-total-row">
                    <td>{programme.total.name}</td>
                    <td className="num">{formatMoney(programme.total.budget)}</td>
                    <td className="num">{formatMoney(programme.total.spent)}</td>
                    <td className="num">{formatMoney(programme.total.remaining)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <MiniTable label="Department" rows={byDept} totals={totals} />
            <MiniTable label="Owner" rows={byOwner} totals={totals} />
          </div>
        </div>
      )}
    </div>
  )
}
