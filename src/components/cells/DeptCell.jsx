import { useState } from 'react'

const ADD_NEW = '__add_new__'

// Department dropdown. Choosing a department commits immediately (no confirm).
// "+ Add department…" opens an inline prompt; the new department is created for
// the whole team and then assigned to this row.
export default function DeptCell({ value, departments, onEdit, onAddDepartment }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const options = departments.includes(value) || !value ? departments : [value, ...departments]

  const handleChange = (e) => {
    const next = e.target.value
    if (next === ADD_NEW) {
      setName('')
      setAdding(true)
      return
    }
    onEdit({ department: next })
  }

  const saveNew = async () => {
    const trimmed = name.trim()
    setAdding(false)
    if (!trimmed || trimmed === value) return
    await onAddDepartment(trimmed)
    onEdit({ department: trimmed })
  }

  if (adding) {
    return (
      <input
        className="cell-input"
        autoFocus
        placeholder="New department"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveNew}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setAdding(false)
        }}
      />
    )
  }

  return (
    <select className="cell-input dept-cell" value={value || ''} onChange={handleChange}>
      {!value && <option value="">—</option>}
      {options.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add department…</option>
    </select>
  )
}
