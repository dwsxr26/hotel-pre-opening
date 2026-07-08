import { useRef, useState } from 'react'
import { Download, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { formatMoney } from '../../lib/format'

const grossOf = (e) => (Number(e.amount_ex_vat) || 0) * (1 + (Number(e.vat_pct) || 0) / 100)

// One editable entry row (forecast or invoice). Uncontrolled inputs commit on blur.
function EntryRow({ entry, onUpdate, onDelete, onAttach, onDownload }) {
  const fileRef = useRef(null)
  const commit = (field, raw) => {
    const val = field === 'title' ? raw : Number(raw) || 0
    if (String(val) !== String(entry[field] ?? '')) onUpdate(entry.id, { [field]: val })
  }
  return (
    <div className="me-row">
      <input
        className="me-title" defaultValue={entry.title} placeholder="Description"
        onBlur={(e) => commit('title', e.target.value)}
      />
      <input
        className="me-num" type="number" step="any" defaultValue={entry.amount_ex_vat}
        onBlur={(e) => commit('amount_ex_vat', e.target.value)} title="Amount ex VAT"
      />
      <input
        className="me-vat" type="number" step="any" defaultValue={entry.vat_pct}
        onBlur={(e) => commit('vat_pct', e.target.value)} title="VAT %"
      />
      <span className="me-total">{formatMoney(grossOf(entry))}</span>
      {entry.type === 'invoice' ? (
        entry.file_path ? (
          <button className="me-file" title={`Download ${entry.file_name}`} onClick={() => onDownload(entry.file_path)}>
            <Download size={13} />
          </button>
        ) : (
          <button className="me-file" title="Attach evidence" onClick={() => fileRef.current?.click()}>
            <Paperclip size={13} />
            <input
              ref={fileRef} type="file" hidden
              onChange={(e) => {
                const f = e.target.files[0]
                e.target.value = ''
                if (f) onAttach(entry, f)
              }}
            />
          </button>
        )
      ) : (
        <span className="me-file" />
      )}
      <button className="me-x" title="Remove" onClick={() => onDelete(entry.id, entry.file_path)}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// Add / edit the forecast breakdown and invoices for one line in one month.
export default function MonthEntriesModal({
  line, monthKey, monthLabel, entries, incl, onAdd, onUpdate, onDelete, onAttach, onDownload, onClose,
}) {
  const [busy, setBusy] = useState(false)
  const forecast = entries.filter((e) => e.type === 'forecast')
  const invoices = entries.filter((e) => e.type === 'invoice')
  const sum = (arr) => arr.reduce((s, e) => s + (incl ? grossOf(e) : Number(e.amount_ex_vat) || 0), 0)

  const add = async (type) => {
    setBusy(true)
    try {
      await onAdd({ line_id: line.id, month: monthKey, type, title: '', amount_ex_vat: 0, vat_pct: 22 })
    } finally {
      setBusy(false)
    }
  }

  const renderSection = (title, type, rows) => (
    <div className="me-section">
      <div className="me-section-hd">
        <span>{title}</span>
        <span className="me-section-sum">{formatMoney(sum(rows))}{incl ? ' incl' : ' ex'} VAT</span>
      </div>
      <div className="me-head">
        <span>Description</span><span className="me-num">Ex VAT</span><span className="me-vat">VAT %</span>
        <span className="me-total">Total</span><span className="me-file" /><span className="me-x" />
      </div>
      {rows.length === 0 && <div className="me-empty">None yet</div>}
      {rows.map((e) => (
        <EntryRow key={e.id} entry={e} onUpdate={onUpdate} onDelete={onDelete} onAttach={onAttach} onDownload={onDownload} />
      ))}
      <button className="btn me-add" disabled={busy} onClick={() => add(type)}>
        <Plus size={13} /> Add {type === 'invoice' ? 'invoice' : 'forecast line'}
      </button>
    </div>
  )

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal me-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close"><X size={18} /></button>
        <h3>{monthLabel}</h3>
        <p title={line.name}>{line.name} · {line.department}</p>
        {renderSection('Forecast', 'forecast', forecast)}
        {renderSection('Invoices', 'invoice', invoices)}
      </div>
    </div>
  )
}
