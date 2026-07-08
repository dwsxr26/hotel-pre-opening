import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
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

// Collapsible "Metrics" for Services: summary by Department and by Owner.
export default function ServicesMetrics({ lines, entriesByLine, closesByLine, incl, open, onToggle }) {
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

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button className="collapse-hd" onClick={onToggle}>
        <ChevronDown size={16} className={`collapse-chev ${open ? 'open' : ''}`} />
        <span className="card-hd" style={{ padding: 0, border: 0 }}>Metrics</span>
        <span className="collapse-hint">
          {formatMoney(totals.reforecast)} reforecast · {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div className="summary-pad" style={{ paddingTop: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <MiniTable label="Department" rows={byDept} totals={totals} />
          <MiniTable label="Owner" rows={byOwner} totals={totals} />
        </div>
      )}
    </div>
  )
}
