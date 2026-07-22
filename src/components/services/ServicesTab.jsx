import { useMemo, useState } from 'react'
import { Download, Minus, Plus } from 'lucide-react'
import { useViewPrefs } from '../../hooks/useViewPrefs'
import { SERVICE_MONTHS, computeLine } from '../../lib/serviceCalc'
import { rowsToCsv, downloadCsv } from '../../lib/csv'
import MultiSelectFilter from '../MultiSelectFilter'
import ServicesMetrics from './ServicesMetrics'
import ServicesTable from './ServicesTable'
import MonthEntriesModal from './MonthEntriesModal'

const DEFAULT_SERVICES_VIEW = {
  svcWidths: {}, svcOrder: [], inclVat: false, metricsOpen: false, zoom: 1,
  svcSort: { key: '', dir: 'asc' }, svcFilters: {},
}
const monthLabel = (key) => SERVICE_MONTHS.find((m) => m.key === key)?.label || key

export default function ServicesTab({
  lines, entriesByLine, closesByLine, items, isAdmin, people, onLineUpdate,
  onCommit, onDownload, onReopen,
}) {
  const { prefs: view, update: setView } = useViewPrefs(true, DEFAULT_SERVICES_VIEW, 'services')
  const [open, setOpen] = useState(null) // { lineId, month }
  const incl = view.inclVat === true
  const zoom = view.zoom || 1
  const setZoom = (z) => setView({ zoom: Math.min(1.5, Math.max(0.6, Math.round(z * 10) / 10)) })
  const metricsZoom = view.metricsZoom || 1
  const setMetricsZoom = (z) => setView({ metricsZoom: Math.min(1.3, Math.max(0.6, Math.round(z * 10) / 10)) })
  const filters = useMemo(() => view.svcFilters || {}, [view.svcFilters])
  const sort = useMemo(() => view.svcSort || { key: '', dir: 'asc' }, [view.svcSort])

  // Individual HR lines are hidden from the detail grid for non-admins. Their
  // figures still flow into the Metrics consolidation (which gets the full
  // `lines` set), so everyone sees the HR totals — just not the line detail.
  const visibleLines = useMemo(
    () => (isAdmin ? lines : lines.filter((l) => (l.department || '').trim().toLowerCase() !== 'hr')),
    [lines, isAdmin],
  )

  // Compute figures for every visible line once.
  const rowsAll = useMemo(
    () => visibleLines.map((line) => ({ line, c: computeLine(line, entriesByLine[line.id], closesByLine[line.id], incl) })),
    [visibleLines, entriesByLine, closesByLine, incl],
  )

  const options = useMemo(() => ({
    line: [...new Set(visibleLines.map((l) => l.name))].sort((a, b) => a.localeCompare(b)),
    department: [...new Set(visibleLines.map((l) => l.department))].sort((a, b) => a.localeCompare(b)),
    owner: [...new Set(visibleLines.map((l) => l.owner || ''))].sort((a, b) => a.localeCompare(b)),
  }), [visibleLines])

  const rows = useMemo(() => {
    let out = rowsAll.filter((r) => {
      if (filters.line?.length && !filters.line.includes(r.line.name)) return false
      if (filters.department?.length && !filters.department.includes(r.line.department)) return false
      if (filters.owner?.length && !filters.owner.includes(r.line.owner || '')) return false
      return true
    })
    if (sort.key) {
      const val = (r) => {
        const k = sort.key
        if (k === 'line') return r.line.name.toLowerCase()
        if (k === 'department') return r.line.department.toLowerCase()
        if (k === 'owner') return (r.line.owner || '').toLowerCase()
        if (k === 'budget') return r.c.budget
        if (k === 'spent') return r.c.spent
        if (k === 'reforecast') return r.c.reforecast
        if (k === 'remaining') return r.c.remaining
        if (k.startsWith('m:')) return r.c.monthly[k.slice(2)]?.effective || 0
        return 0
      }
      out = [...out].sort((a, b) => {
        const av = val(a)
        const bv = val(b)
        if (av < bv) return sort.dir === 'asc' ? -1 : 1
        if (av > bv) return sort.dir === 'asc' ? 1 : -1
        return 0
      })
    }
    return out
  }, [rowsAll, filters, sort])

  const totals = useMemo(() => {
    const t = { budget: 0, spent: 0, reforecast: 0, remaining: 0, months: {} }
    SERVICE_MONTHS.forEach((m) => (t.months[m.key] = 0))
    for (const r of rows) {
      t.budget += r.c.budget
      t.spent += r.c.spent
      t.reforecast += r.c.reforecast
      t.remaining += r.c.remaining
      SERVICE_MONTHS.forEach((m) => (t.months[m.key] += r.c.monthly[m.key].effective))
    }
    return t
  }, [rows])

  const onSortToggle = (key) =>
    setView((p) => {
      const cur = p.svcSort || { key: '', dir: 'asc' }
      return { svcSort: cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' } }
    })

  const setFilter = (col, vals) => setView((p) => ({ svcFilters: { ...(p.svcFilters || {}), [col]: vals } }))
  const anyFilter = ['line', 'department', 'owner'].some((c) => filters[c]?.length)

  const exportCsv = () => {
    const headers = ['Line', 'Department', 'Owner', 'Budget', 'Spent', 'Reforecast', 'Remaining', ...SERVICE_MONTHS.map((m) => m.label)]
    const data = rows.map((r) => [
      r.line.name, r.line.department, r.line.owner, r.c.budget, r.c.spent, r.c.reforecast, r.c.remaining,
      ...SERVICE_MONTHS.map((m) => r.c.monthly[m.key].effective),
    ])
    downloadCsv('florence-services.csv', rowsToCsv(headers, data))
  }

  const openLine = open && lines.find((l) => l.id === open.lineId)
  const openEntries = useMemo(() => {
    if (!open) return []
    return (entriesByLine[open.lineId] || []).filter((e) => e.month === open.month)
  }, [open, entriesByLine])

  return (
    <section>
      <ServicesMetrics
        lines={lines}
        entriesByLine={entriesByLine}
        closesByLine={closesByLine}
        items={items}
        incl={incl}
        open={view.metricsOpen === true}
        onToggle={() => setView({ metricsOpen: !(view.metricsOpen === true) })}
        zoom={metricsZoom}
        onZoom={(d) => setMetricsZoom(metricsZoom + d)}
      />

      <div className="svc-toolbar">
        <span className="filterbar-label">Cash flow</span>
        <div className="seg">
          <button className={`seg-btn ${!incl ? 'on' : ''}`} onClick={() => setView({ inclVat: false })}>Excl. VAT</button>
          <button className={`seg-btn ${incl ? 'on' : ''}`} onClick={() => setView({ inclVat: true })}>Incl. VAT</button>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={exportCsv} title="Export the current view to CSV">
          <Download size={14} /> Export CSV
        </button>
        <div className="zoomer" title="Zoom the table">
          <button className="btn icon-btn" onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.6} aria-label="Zoom out">
            <Minus size={15} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn icon-btn" onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 1.5} aria-label="Zoom in">
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="filterbar">
        <span className="filterbar-label">Filter</span>
        <MultiSelectFilter label="Line" options={options.line} selected={filters.line || []} onChange={(v) => setFilter('line', v)} />
        <MultiSelectFilter label="Department" options={options.department} selected={filters.department || []} onChange={(v) => setFilter('department', v)} />
        <MultiSelectFilter label="Owner" options={options.owner} selected={filters.owner || []} onChange={(v) => setFilter('owner', v)} />
        {anyFilter && (
          <button className="linkbtn" onClick={() => setView({ svcFilters: {} })}>Clear filters</button>
        )}
        <span className="row-count">{rows.length} of {visibleLines.length} lines</span>
      </div>

      <ServicesTable
        rows={rows}
        totals={totals}
        sort={sort}
        onSortToggle={onSortToggle}
        view={view}
        setView={setView}
        isAdmin={isAdmin}
        people={people}
        onLineUpdate={onLineUpdate}
        zoom={zoom}
        onOpenMonth={(line, month) => setOpen({ lineId: line.id, month })}
      />

      {openLine && (
        <MonthEntriesModal
          key={`${open.lineId}:${open.month}`}
          line={openLine}
          monthKey={open.month}
          monthLabel={monthLabel(open.month)}
          entries={openEntries}
          lineEntries={entriesByLine[open.lineId] || []}
          closesForLine={closesByLine[open.lineId] || {}}
          disposition={closesByLine[open.lineId]?.[open.month]}
          onCommit={(ops, closePlan) => onCommit(open.lineId, open.month, ops, closePlan)}
          onDownload={onDownload}
          onReopen={() => onReopen(open.lineId, open.month)}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}
