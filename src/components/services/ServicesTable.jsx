import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS, isPastMonth, computeLine } from '../../lib/serviceCalc'

// Read-only Services grid (Stage 1): budget lines with Budget / Spent /
// Reforecast / Remaining and the monthly forecast phasing. The Line column is
// pinned; past months (through Jun-26) are tinted to mark the locked boundary.
export default function ServicesTable({ lines, entriesByLine, closesByLine, incl }) {
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
      <div className="table-scroll">
        <table className="grid svc-grid">
          <thead>
            <tr>
              <th className="pinned pin-svc">Line</th>
              <th>Department</th>
              <th>Owner</th>
              <th className="cell-num">Budget</th>
              <th className="cell-num">Spent</th>
              <th className="cell-num">Reforecast</th>
              <th className="cell-num">Remaining</th>
              {SERVICE_MONTHS.map((m) => (
                <th key={m.key} className={`cell-num svc-month ${isPastMonth(m.key) ? 'svc-past' : ''}`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const c = computeLine(line, entriesByLine[line.id], closesByLine[line.id], incl)
              const over = c.reforecast > c.budget + 0.5
              return (
                <tr key={line.id}>
                  <td className="pinned pin-svc">
                    <span className="cell-pad" title={line.name}>{line.name}</span>
                  </td>
                  <td><span className="cell-pad">{line.department}</span></td>
                  <td><span className="cell-pad">{line.owner || '—'}</span></td>
                  <td className="cell-num"><span className="cell-pad">{formatMoney(c.budget)}</span></td>
                  <td className="cell-num"><span className="cell-pad">{formatMoney(c.spent)}</span></td>
                  <td className={`cell-num ${over ? 'svc-over' : ''}`}>
                    <span className="cell-pad">{formatMoney(c.reforecast)}</span>
                  </td>
                  <td className="cell-num"><span className="cell-pad">{formatMoney(c.remaining)}</span></td>
                  {SERVICE_MONTHS.map((m) => {
                    const mv = c.monthly[m.key]
                    return (
                      <td key={m.key} className={`cell-num svc-month ${isPastMonth(m.key) ? 'svc-past' : ''}`}>
                        <span className="cell-pad">{mv.effective ? formatMoney(mv.effective) : '-'}</span>
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
