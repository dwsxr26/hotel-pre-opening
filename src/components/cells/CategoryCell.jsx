import { useState } from 'react'

const ADD_NEW = '__add_new__'

// Category dropdown. Choosing an existing category asks for confirmation
// (category is a sensitive column). Choosing "+ Add new category…" opens a
// small inline prompt; the new category is created for the whole team and then
// assigned to this row.
//
// Props: value, categories (string[]), onConfirm(patch, meta), onAddCategory(name) => Promise
export default function CategoryCell({ value, categories, onConfirm, onAddCategory }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const options = categories.includes(value) || !value ? categories : [value, ...categories]

  const handleChange = (e) => {
    const next = e.target.value
    if (next === ADD_NEW) {
      setName('')
      setAdding(true)
      return
    }
    if (next !== value) {
      onConfirm({ category: next }, { label: 'Category', from: value, to: next })
    }
  }

  const saveNew = async () => {
    const trimmed = name.trim()
    setAdding(false)
    if (!trimmed || trimmed === value) return
    await onAddCategory(trimmed)
    // Assigning a category the user just typed is intentional — no extra confirm.
    onConfirm({ category: trimmed }, null)
  }

  if (adding) {
    return (
      <input
        className="cell-input"
        autoFocus
        placeholder="New category name"
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
    <select className="cell-input" value={value || ''} onChange={handleChange}>
      {!value && <option value="">—</option>}
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new category…</option>
    </select>
  )
}
