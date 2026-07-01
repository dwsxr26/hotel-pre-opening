import { useEffect, useRef, useState } from 'react'

// A cell that looks like flat text until clicked, opens an inline input, and on
// commit asks the parent to confirm before the change is saved. Used for the
// sensitive columns: package, item, unit price.
//
// Props:
//   value       raw underlying value
//   field       column key to patch (e.g. 'unit_price')
//   label       human label for the confirm dialog (e.g. 'Unit price')
//   parse       (inputString) => value            default: trim
//   formatValue (value) => string for display/preview  default: String
//   editValue   (value) => string shown in input  default: String
//   numeric     right-align + numeric input mode
//   emptyText   shown (muted) when the display value is empty
//   onConfirm   (patch, changeMeta) => void        opens the confirm modal
export default function ConfirmEditCell({
  value,
  field,
  label,
  parse = (s) => s.trim(),
  formatValue = (v) => (v == null ? '' : String(v)),
  editValue = (v) => (v == null ? '' : String(v)),
  numeric = false,
  emptyText = '',
  onConfirm,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const begin = () => {
    setDraft(editValue(value))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const next = parse(draft)
    // Compare loosely so "2000" vs 2000 doesn't false-trigger.
    if (String(next) === String(value ?? '')) return
    onConfirm(
      { [field]: next },
      { label, from: formatValue(value), to: formatValue(next) },
    )
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`cell-input${numeric ? ' cell-num' : ''}`}
        inputMode={numeric ? 'decimal' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  const shown = formatValue(value)
  return (
    <span
      className={`cell-pad editable${shown ? '' : ' editable-empty'}${numeric ? ' cell-num' : ''}`}
      title={shown ? `${shown} — click to edit` : 'Click to edit'}
      onClick={begin}
    >
      {shown || emptyText || '—'}
    </span>
  )
}
