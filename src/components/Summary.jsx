import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { STATUSES } from '../lib/constants'
import { formatInt, formatMoney, lineTotal } from '../lib/format'
import StatusBars from './StatusBars'

// Reusable "summary by <field>" view. Used for both Owner and Supplier
// (groupKey = 'owner' | 'supplier'). Counts are line items, not quantities.
// The at-a-glance table has a sticky header, click-to-sort columns and a
// name filter.
export default function Summary({ items, groupKey, groupLabel, blankLabel }) {
  const [selected, setSelected] = useState('__all')
  const [sort, setSort] = useState({ key: 'value', dir: 'desc' })
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const names = [...new Set(items.map((r) => r[groupKey] || ''))]
    const real = names.filter(Boolean).sort((a, b) => a.localeCompare(b))
    return names.includes('') ? [...real, ''] : real
  }, [items, groupKey])

  const rowsFor = (name) => (name === '__all' ? items : items.filter((r) => (r[groupKey] || '') === name))

  const statsOf = (rows) => {
    const value = rows.reduce((s, r) => s + lineTotal(r), 0)
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]))
    rows.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
    })
    return { count: rows.length, value, byStatus }
  }

  const nameOf = (n) => n || blankLabel
  const selStats = statsOf(rowsFor(selected))

  // Build + sort + filter the at-a-glance rows.
  const tableRows = useMemo(() => {
    const rows = groups.map((g) => ({ key: g, name: nameOf(g), ...statsOf(rowsFor(g)) }))
    const q = query.trim().toLowerCase()
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows
    const dir = sort.dir === 'asc' ? 1 : -1
    const val = (r) => {
      if (sort.key === 'name') return r.name.toLowerCase()
      if (sort.key === 'count') return r.count
      if (sort.key === 'value') return r.value
      return r.byStatus[sort.key] || 0 // a status column
    }
    return [...filtered].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, items, query, sort])

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const sortIcon = (colKey) =>
    sort.key !== colKey ? (
      <ChevronsUpDown size={12} opacity={0.4} />
    ) : sort.dir === 'asc' ? (
      <ArrowUp size={13} />
    ) : (
      <ArrowDown size={13} />
    )

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
          <div className="card-hd" style={{ padding: 0, border: 0, marginBottom: 12 }}>Totals</div>
          <div className="summary-row">
            <span className="summary-key">{groupLabel}</span>
            <span className="summary-val">{selected === '__all' ? `All ${groupLabel.toLowerCase()}s` : nameOf(selected)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Line items</span>
            <span className="summary-val">{formatInt(selStats.count)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Total cost</span>
            <span className="summary-val">{formatMoney(selStats.value)}</span>
          </div>
        </div>

        <div className="card summary-pad">
          <StatusBars rows={rowsFor(selected)} />
        </div>
      </div>

      <div className="card overflow-hidden" style={{ marginTop: 16 }}>
        <div className="summary-table-hd">
          <span className="card-hd" style={{ padding: 0, border: 0 }}>
            All {groupLabel.toLowerCase()}s at a glance
          </span>
          <span className="ctrl summary-search">
            <Search size={14} color="#6b7280" />
            <input placeholder={`Filter ${groupLabel.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
          </span>
        </div>
        <div className="summary-table-scroll">
          <table className="summary-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('name')}>
                  <span className="th-sortwrap">{groupLabel} {sortIcon('name')}</span>
                </th>
                <th className="num sortable" onClick={() => toggleSort('count')}>
                  <span className="th-sortwrap">Items {sortIcon('count')}</span>
                </th>
                <th className="num sortable" onClick={() => toggleSort('value')}>
                  <span className="th-sortwrap">Value {sortIcon('value')}</span>
                </th>
                {STATUSES.map((s) => (
                  <th key={s} className="num sortable" onClick={() => toggleSort(s)}>
                    <span className="th-sortwrap">{s} {sortIcon(s)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.key || '__blank'}>
                  <td>{r.name}</td>
                  <td className="num">{formatInt(r.count)}</td>
                  <td className="num">{formatMoney(r.value)}</td>
                  {STATUSES.map((s) => (
                    <td key={s} className="num" style={{ color: 'var(--muted-fg)' }}>
                      {formatInt(r.byStatus[s] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={3 + STATUSES.length} className="center-note">
                    No {groupLabel.toLowerCase()}s match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
