import { useRef, useState } from 'react'
import { Download, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS } from '../../lib/serviceCalc'

const grossOf = (e) => (Number(e.amount_ex_vat) || 0) * (1 + (Number(e.vat_pct) || 0) / 100)

// Editable entry row. Inputs are controlled so a blocked (over-budget) edit
// can revert cleanly; commit happens on blur.
function EntryRow({ entry, onUpdate, onDelete, onAttach, onDownload }) {
  // Initialized from props; a value-based key (in the parent) remounts this row
  // when the saved entry changes, so no effect-based prop sync is needed.
  const [title, setTitle] = useState(entry.title)
  const [amount, setAmount] = useState(entry.amount_ex_vat)
  const [vat, setVat] = useState(entry.vat_pct)
  const fileRef = useRef(null)

  const commit = async (field, val, reset) => {
    if (String(val) === String(entry[field] ?? '')) return
    const ok = await onUpdate(entry.id, { [field]: val })
    if (ok === false) reset()
  }

  const total = (Number(amount) || 0) * (1 + (Number(vat) || 0) / 100)

  return (
    <div className="me-row">
      <input
        className="me-title" value={title} placeholder="Description"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => commit('title', title, () => setTitle(entry.title))}
      />
      <input
        className="me-num" type="number" step="any" value={amount} title="Amount ex VAT"
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => commit('amount_ex_vat', Number(amount) || 0, () => setAmount(entry.amount_ex_vat))}
      />
      <input
        className="me-vat" type="number" step="any" value={vat} title="VAT %"
        onChange={(e) => setVat(e.target.value)}
        onBlur={() => commit('vat_pct', Number(vat) || 0, () => setVat(entry.vat_pct))}
      />
      <span className="me-total">{formatMoney(total)}</span>
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

// Add/edit the forecast breakdown and invoices for one line in one month, and
// close the month (cancel unused / roll forward).
export default function MonthEntriesModal({
  line, monthKey, monthLabel, entries, incl, disposition,
  onAdd, onUpdate, onDelete, onAttach, onDownload, onCloseMonth, onReopenMonth, onClose,
}) {
  const [busy, setBusy] = useState(false)
  const forecast = entries.filter((e) => e.type === 'forecast')
  const invoices = entries.filter((e) => e.type === 'invoice')
  const sumEx = (arr) => arr.reduce((s, e) => s + (Number(e.amount_ex_vat) || 0), 0)
  const sumView = (arr) => arr.reduce((s, e) => s + (incl ? grossOf(e) : Number(e.amount_ex_vat) || 0), 0)

  const unused = Math.max(0, sumEx(forecast) - sumEx(invoices))
  const idx = SERVICE_MONTHS.findIndex((m) => m.key === monthKey)
  const nextMonth = SERVICE_MONTHS[idx + 1]
  const closed = !!disposition

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
        <span className="me-section-sum">{formatMoney(sumView(rows))}{incl ? ' incl' : ' ex'} VAT</span>
      </div>
      <div className="me-head">
        <span>Description</span><span className="me-num">Ex VAT</span><span className="me-vat">VAT %</span>
        <span className="me-total">Total</span><span className="me-file" /><span className="me-x" />
      </div>
      {rows.length === 0 && <div className="me-empty">None yet</div>}
      {rows.map((e) => (
        <EntryRow
          key={`${e.id}:${e.amount_ex_vat}:${e.vat_pct}:${e.title}:${e.file_path || ''}`}
          entry={e}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAttach={onAttach}
          onDownload={onDownload}
        />
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

        <div className="me-footer">
          {closed ? (
            <div className="me-closed">
              <span>Month closed — unused {disposition === 'rolled' ? 'rolled forward' : 'cancelled'}.</span>
              <button className="btn" onClick={onReopenMonth}>Reopen</button>
            </div>
          ) : (
            <div className="me-close-actions">
              <span className="me-unused">
                {unused > 0
                  ? `Unused this month: ${formatMoney(unused)} ex VAT`
                  : 'Forecast fully invoiced.'}
              </span>
              {unused > 0 ? (
                <>
                  <button className="btn" onClick={() => onCloseMonth('cancelled')}>Cancel unused</button>
                  {nextMonth && (
                    <button className="btn btn-primary" onClick={() => onCloseMonth('rolled')}>
                      Roll forward to {nextMonth.label}
                    </button>
                  )}
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => onCloseMonth('cancelled')}>All invoices added</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
