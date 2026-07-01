// Owner dropdown. Lists team members (by their "First L." display name). If the
// current value isn't a known team member (e.g. legacy "Person_1" data), it's
// kept as a selectable option so nothing is lost.
export default function OwnerCell({ value, people, onEdit }) {
  const options = value && !people.includes(value) ? [value, ...people] : people
  return (
    <select className="cell-input" value={value || ''} onChange={(e) => onEdit({ owner: e.target.value })}>
      <option value="">Unassigned</option>
      {options.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  )
}
