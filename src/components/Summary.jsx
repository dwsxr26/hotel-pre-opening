import { useMemo, useState } from 'react'
import { STATUSES, STATUS_CLASS } from '../lib/constants'
import { formatInt, formatMoney, lineTotal } from '../lib/format'

// Reusable "summary by <field>" view. Used for both Owner and Supplier
// (groupKey = 'owner' | 'supplier'). Counts are line items, not quantities.
export default function Summary({ items, groupKey, groupLabel, blankLabel }) {
  const groups = useMemo(() => {
    const names = [...new Set(items.map((r) => r[groupKey] || ''))]
    // Real values first (alphabetical), blank bucket last.
    const real = names.filter(Boolean).sort((a, b) => a.localeCompare(b))
    return names.includes('') ? [...real, ''] : real
  }, [items, groupKey])

  const [selected, setSelected] = useState('__all')

  const rowsFor = (name) => (name === '__all' ? items : items.filter((r) => (r[groupKey] || '') === name))

  const stats = (rows) => {
    const value = rows.reduce((s, r) => s + lineTotal(r), 0)
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]))
    rows.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
    })
    return { count: rows.length, value, byStatus }
  }

  const sel = stats(rowsFor(selected))
  const nameOf = (n) => n || blankLabel

  return (
    <section>
      <div className="summary-controls">
        <label style={{ fontSize: 13, fontWeight: 500 }}>{groupLabel}</label>
        <select className="ctrl" style={{ minWidth: 200 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="__all">All {groupLabel.toLowerCase()}s</option>
          {groups.map((g) => (
            <option key={g || '__blank'} value={g}>
              {nameOf(g)}
            </option>
          ))}
        </select>
        <span className="row-count">Counts are line items, not quantities.</span>
      </div>

      <div className="summary-grid">
        <div className="card summary-pad">
          <div className="card-hd" style={{ padding: 0, border: 0, marginBottom: 12 }}>
            Totals
          </div>
          <div className="summary-row">
            <span className="summary-key">Line items</span>
            <span className="summary-val">{formatInt(sel.count)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Total value</span>
            <span className="summary-val">{formatMoney(sel.value)}</span>
          </div>
        </div>

        <div className="card summary-pad">
          <div className="card-hd" style={{ padding: 0, border: 0, marginBottom: 12 }}>
            Line items by status
          </div>
          {STATUSES.map((s) => {
            const n = sel.byStatus[s] || 0
            const pct = sel.count ? Math.round((n / sel.count) * 100) : 0
            return (
              <div key={s} className="summary-row">
                <span className={`badge ${STATUS_CLASS[s]}`}>
                  <span className="dot" />
                  {s}
                </span>
                <span className="summary-val">
                  {formatInt(n)} <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>({pct}%)</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card overflow-hidden" style={{ marginTop: 16 }}>
        <div className="card-hd">All {groupLabel.toLowerCase()}s at a glance</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="summary-table">
            <thead>
              <tr>
                <th>{groupLabel}</th>
                <th className="num">Items</th>
                <th className="num">Value</th>
                {STATUSES.map((s) => (
                  <th key={s} className="num">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const st = stats(rowsFor(g))
                return (
                  <tr key={g || '__blank'}>
                    <td>{nameOf(g)}</td>
                    <td className="num">{formatInt(st.count)}</td>
                    <td className="num">{formatMoney(st.value)}</td>
                    {STATUSES.map((s) => (
                      <td key={s} className="num" style={{ color: 'var(--muted-fg)' }}>
                        {formatInt(st.byStatus[s] || 0)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
