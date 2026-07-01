import { STATUSES, STATUS_CLASS } from '../../lib/constants'

// Inline status dropdown with a coloured badge dot. Committed immediately.
export default function StatusCell({ value, onEdit }) {
  const cls = STATUS_CLASS[value] || 'st-not'
  return (
    <div className="status-cell">
      <span className={`badge ${cls}`}>
        <span className="dot" />
      </span>
      <select
        className="cell-input"
        value={value || 'Not ordered'}
        onChange={(e) => onEdit({ status: e.target.value })}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  )
}
