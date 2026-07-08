import { useMemo, useState } from 'react'
import { useViewPrefs } from '../../hooks/useViewPrefs'
import { SERVICE_MONTHS } from '../../lib/serviceCalc'
import ServicesMetrics from './ServicesMetrics'
import ServicesTable from './ServicesTable'
import MonthEntriesModal from './MonthEntriesModal'

const DEFAULT_SERVICES_VIEW = { columnSizing: {}, columnOrder: [], inclVat: false, metricsOpen: false }
const monthLabel = (key) => SERVICE_MONTHS.find((m) => m.key === key)?.label || key

// Services module. VAT toggle + Metrics + the budget grid, with per-user column
// layout persisted. Clicking a month cell opens the entry editor.
export default function ServicesTab({
  lines, entriesByLine, closesByLine, onEntryAdd, onEntryUpdate, onEntryDelete, onEntryAttach, onDownload,
}) {
  const { prefs: view, update: setView } = useViewPrefs(true, DEFAULT_SERVICES_VIEW, 'services')
  const [open, setOpen] = useState(null) // { lineId, month }
  const incl = view.inclVat === true

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
        incl={incl}
        open={view.metricsOpen === true}
        onToggle={() => setView({ metricsOpen: !(view.metricsOpen === true) })}
      />

      <div className="svc-toolbar">
        <span className="filterbar-label">Cash flow</span>
        <div className="seg">
          <button className={`seg-btn ${!incl ? 'on' : ''}`} onClick={() => setView({ inclVat: false })}>Excl. VAT</button>
          <button className={`seg-btn ${incl ? 'on' : ''}`} onClick={() => setView({ inclVat: true })}>Incl. VAT</button>
        </div>
        <span className="row-count">Click a month cell to add forecast lines &amp; invoices. Scroll left for history.</span>
      </div>

      <ServicesTable
        lines={lines}
        entriesByLine={entriesByLine}
        closesByLine={closesByLine}
        incl={incl}
        view={view}
        setView={setView}
        onOpenMonth={(line, month) => setOpen({ lineId: line.id, month })}
      />

      {openLine && (
        <MonthEntriesModal
          line={openLine}
          monthKey={open.month}
          monthLabel={monthLabel(open.month)}
          entries={openEntries}
          incl={incl}
          onAdd={onEntryAdd}
          onUpdate={onEntryUpdate}
          onDelete={onEntryDelete}
          onAttach={onEntryAttach}
          onDownload={onDownload}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}
