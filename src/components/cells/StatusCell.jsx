import { STATUSES, STATUS_CLASS } from '../../lib/constants'

// Inline status shown as a coloured pill (dot + label) that is itself the
// dropdown. Committed immediately.
export default function StatusCell({ value, onEdit }) {
  const cls = STATUS_CLASS[value] || 'st-not'
  return (
    <div className="status-cell">
      <span className={`badge status-pill ${cls}`}>
        <span className="dot" />
        <select
          className="status-select"
          value={value || 'Not ordered'}
          onChange={(e) => onEdit({ status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </span>
    </div>
  )
}
