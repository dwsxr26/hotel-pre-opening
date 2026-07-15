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

function MiniTable({ label, rows, footer }) {
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
            {footer.map((f) => (
              <tr key={f.label} className={f.cls || ''}>
                <td>{f.label}</td>
                {cells(f.row)}
              </tr>
            ))}
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
  const lineTot = (r) => (Number(r.qty) || 0) * (Number(r.unit_price) || 0)
  // OS&E figures for a set of order items (ex-VAT).
  const osneOf = (its) => {
    const budget = its.reduce((s, r) => s + (Number(r.budget) || 0), 0)
    const spent = its.filter((r) => r.status === 'Order placed' || r.status === 'Order complete').reduce((s, r) => s + lineTot(r), 0)
    const remaining = its.filter((r) => r.status === 'Not ordered').reduce((s, r) => s + lineTot(r), 0)
    return { budget, spent, remaining, reforecast: spent + remaining }
  }
  const addFig = (a, b) => ({
    budget: a.budget + b.budget, spent: a.spent + b.spent, reforecast: a.reforecast + b.reforecast, remaining: a.remaining + b.remaining,
  })

  // Services broken down by department (OS&E shown as its own footer line).
  const byDept = useMemo(() => {
    const groups = {}
    for (const l of lines) (groups[l.department || '—'] ||= []).push(l)
    return Object.entries(groups)
      .map(([name, ls]) => ({ name, ...aggregate(ls, entriesByLine, closesByLine, incl) }))
      .sort((a, b) => b.reforecast - a.reforecast)
  }, [lines, entriesByLine, closesByLine, incl])

  const totals = useMemo(() => aggregate(lines, entriesByLine, closesByLine, incl), [lines, entriesByLine, closesByLine, incl])
  const osne = useMemo(() => osneOf(items), [items]) // eslint-disable-line react-hooks/exhaustive-deps
  const grand = addFig(totals, osne)

  // By owner: combine each person's Services lines AND OS&E orders into one row.
  const byOwner = useMemo(() => {
    const names = new Set()
    lines.forEach((l) => names.add(l.owner || '—'))
    items.forEach((i) => names.add(i.owner || '—'))
    return [...names]
      .map((name) => {
        const svc = aggregate(lines.filter((l) => (l.owner || '—') === name), entriesByLine, closesByLine, incl)
        const os = osneOf(items.filter((i) => (i.owner || '—') === name))
        return { name, ...addFig(svc, os) }
      })
      .sort((a, b) => b.reforecast - a.reforecast)
  }, [lines, items, entriesByLine, closesByLine, incl]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <MiniTable
            label="Department"
            rows={byDept}
            footer={[
              { label: 'Sub-Total Services', row: totals, cls: 'svc-subtotal-row' },
              { label: 'OS&E Orders', row: osne },
              { label: 'Total', row: grand, cls: 'svc-total-row' },
            ]}
          />
          <MiniTable
            label="Owner"
            rows={byOwner}
            footer={[{ label: 'Total', row: grand, cls: 'svc-total-row' }]}
          />
        </div>
      )}
    </div>
  )
}
