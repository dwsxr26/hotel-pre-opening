import { Calendar } from 'lucide-react'
import { formatDate } from '../../lib/format'

// Estimated arrival date. When no date is set the cell shows only the calendar
// icon; the native date picker is layered invisibly over the icon button.
export default function DateCell({ value, onEdit }) {
  const label = formatDate(value)
  return (
    <div className="date-cell">
      {label ? <span className="date-text">{label}</span> : <span className="date-text date-placeholder" />}
      <button type="button" className="date-btn" title={label ? 'Change date' : 'Set date'}>
        <Calendar size={15} />
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onEdit({ est_arrival: e.target.value || null })}
        />
      </button>
    </div>
  )
}
