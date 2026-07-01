import { useEffect, useId, useRef, useState } from 'react'

// Flat inline text editor, committed on blur/Enter with no confirmation.
// Used for supplier, invoice/order no., description/ref and owner. Pass
// `options` to attach a datalist of suggestions (owners, suppliers).
export default function InlineTextCell({ value, field, onEdit, options, numeric = false, placeholder = '' }) {
  const [draft, setDraft] = useState(value ?? '')
  const listId = useId()
  const dirty = useRef(false)

  // Keep in sync when the row changes underneath us (e.g. realtime update).
  useEffect(() => {
    if (!dirty.current) setDraft(value ?? '')
  }, [value])

  const commit = () => {
    dirty.current = false
    const next = draft.trim()
    if (next === (value ?? '')) return
    onEdit({ [field]: next })
  }

  return (
    <>
      <input
        className={`cell-input${numeric ? ' cell-num' : ''}`}
        list={options ? listId : undefined}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          dirty.current = true
          setDraft(e.target.value)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            dirty.current = false
            setDraft(value ?? '')
            e.currentTarget.blur()
          }
        }}
      />
      {options && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  )
}
