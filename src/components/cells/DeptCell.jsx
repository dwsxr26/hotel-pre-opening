import { DEPARTMENTS } from '../../lib/departments'

// Inline department dropdown. Committed immediately (no confirmation).
export default function DeptCell({ value, onEdit }) {
  return (
    <select
      className="cell-input dept-cell"
      value={value || 'OS&E'}
      onChange={(e) => onEdit({ department: e.target.value })}
    >
      {DEPARTMENTS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  )
}
