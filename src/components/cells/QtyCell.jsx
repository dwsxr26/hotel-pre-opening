import { useEffect, useRef, useState } from 'react'

// Inline numeric editor for quantity. Committed on blur/Enter, no confirmation.
export default function QtyCell({ value, onEdit }) {
  const [draft, setDraft] = useState(value ?? 0)
  const dirty = useRef(false)

  useEffect(() => {
    if (!dirty.current) setDraft(value ?? 0)
  }, [value])

  const commit = () => {
    dirty.current = false
    const next = Number(draft) || 0
    if (next === (Number(value) || 0)) return
    onEdit({ qty: next })
  }

  return (
    <input
      className="cell-input cell-num"
      type="number"
      step="any"
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
          setDraft(value ?? 0)
          e.currentTarget.blur()
        }
      }}
    />
  )
}
