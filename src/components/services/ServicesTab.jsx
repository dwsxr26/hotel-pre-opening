import { useState } from 'react'
import ServicesMetrics from './ServicesMetrics'
import ServicesTable from './ServicesTable'

// Services module (Stage 1: read-only). VAT toggle + Metrics + the budget grid.
export default function ServicesTab({ lines, entriesByLine, closesByLine }) {
  const [incl, setIncl] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)

  return (
    <section>
      <ServicesMetrics
        lines={lines}
        entriesByLine={entriesByLine}
        closesByLine={closesByLine}
        incl={incl}
        open={metricsOpen}
        onToggle={() => setMetricsOpen((o) => !o)}
      />

      <div className="svc-toolbar">
        <span className="filterbar-label">Cash flow</span>
        <div className="seg">
          <button className={`seg-btn ${!incl ? 'on' : ''}`} onClick={() => setIncl(false)}>Excl. VAT</button>
          <button className={`seg-btn ${incl ? 'on' : ''}`} onClick={() => setIncl(true)}>Incl. VAT</button>
        </div>
        <span className="row-count">Past months (through Jun-26) are locked; later months are the forecast.</span>
      </div>

      <ServicesTable lines={lines} entriesByLine={entriesByLine} closesByLine={closesByLine} incl={incl} />
    </section>
  )
}
