import { X } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS } from '../../lib/serviceCalc'

// Read-only history of overspend approvals for one service line: who approved
// which month, how (reallocated vs accepted), the reason, and any reductions.
const monthLabel = (key) => SERVICE_MONTHS.find((m) => m.key === key)?.label || key
const when = (ts) => (ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function OverspendHistoryModal({ line, approvals, lineNameById, nameById, onClose }) {
  const sorted = [...approvals].sort((a, b) => (a.month < b.month ? 1 : -1))
  const name = (id) => (id && nameById[id]) || 'Someone'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal ovh-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close"><X size={18} /></button>
        <h3>Overspend history</h3>
        <p title={line.name}>{line.name} · {line.department}</p>

        {sorted.length === 0 && <div className="me-status">No overspend records for this line.</div>}

        <div className="ovh-list">
          {sorted.map((a) => (
            <div key={a.id} className={`ovh-item ${a.status === 'pending' ? 'ovh-pending' : ''}`}>
              <div className="ovh-head">
                <span className="ovh-month">{monthLabel(a.month)}</span>
                <span className={`ovh-badge ${a.status}`}>{a.status === 'pending' ? 'Awaiting approval' : 'Approved'}</span>
                <span className="ovh-amt">{formatMoney(a.overspend_amount)} over</span>
              </div>
              <div className="ovh-body">
                {a.status === 'pending' ? (
                  <div className="ovh-line">Requested by {name(a.requested_by)} on {when(a.requested_at)}.</div>
                ) : (
                  <>
                    <div className="ovh-line">
                      {a.method === 'reallocated' ? 'Recovered by reducing budget elsewhere' : 'Accepted as a true overspend'} —
                      approved by {name(a.approved_by)} on {when(a.approved_at)}.
                    </div>
                    {a.method === 'reallocated' && a.reductions?.length > 0 && (
                      <ul className="ovh-reductions">
                        {a.reductions.map((r) => (
                          <li key={r.id}>{lineNameById[r.line_id] || 'A line'} reduced by {formatMoney(r.amount)}</li>
                        ))}
                      </ul>
                    )}
                    {a.note && <div className="ovh-note">“{a.note}”</div>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="me-close-actions">
          <div className="spacer" />
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
