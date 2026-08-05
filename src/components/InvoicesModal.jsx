import { useState } from 'react'
import { Eye, Paperclip, X } from 'lucide-react'
import { formatMoney } from '../lib/format'
import ConfirmModal from './ConfirmModal'
import FileDropModal from './services/FileDropModal'

// The single invoice / receipt for one OS&E order line item. Unlike the Overview
// (many invoices per line-month), each order line carries at MOST ONE invoice —
// if a package is split across suppliers, the team adds a new line and an admin
// re-budgets it. Buffered: nothing hits the DB until Save, and the evidence file
// uploads on commit (so a cancelled modal leaves no orphans). The commit ops
// shape ({ adds | updates | deletes }) matches the Services commit handler.
export default function InvoicesModal({ item, invoice, onCommit, onDownload, onClose }) {
  const [title, setTitle] = useState(invoice?.title || '')
  const [pay, setPay] = useState(invoice?.pay_status || 'to_be_paid')
  const [amount, setAmount] = useState(invoice ? String(invoice.amount_ex_vat) : '')
  const [vat, setVat] = useState(invoice ? String(invoice.vat_pct) : '22')
  const [file, setFile] = useState(null) // pending upload (replaces evidence on save)
  const [fileName, setFileName] = useState(invoice?.file_name || null)
  const [attaching, setAttaching] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [saving, setSaving] = useState(false)

  const isNew = !invoice
  const hasStoredFile = !!invoice?.file_path
  const ex = Number(amount) || 0
  const total = ex * (1 + (Number(vat) || 0) / 100)
  // Evidence is required: an existing stored file or a pending upload.
  const needEvidence = !hasStoredFile && !file

  const save = async () => {
    if (needEvidence || saving) return
    setSaving(true)
    const next = { title: title.trim(), pay_status: pay, amount_ex_vat: ex, vat_pct: Number(vat) || 0 }
    let ops
    if (isNew) {
      ops = { adds: [{ ...next, _file: file }] }
    } else {
      const patch = {}
      if (next.title !== (invoice.title || '')) patch.title = next.title
      if (next.pay_status !== (invoice.pay_status || 'to_be_paid')) patch.pay_status = next.pay_status
      if (next.amount_ex_vat !== (Number(invoice.amount_ex_vat) || 0)) patch.amount_ex_vat = next.amount_ex_vat
      if (next.vat_pct !== (Number(invoice.vat_pct) || 0)) patch.vat_pct = next.vat_pct
      ops = { updates: [{ id: invoice.id, patch, _file: file }] }
    }
    try {
      await onCommit(ops)
    } finally {
      setSaving(false)
      onClose()
    }
  }

  const remove = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onCommit({ deletes: [{ id: invoice.id, file_path: invoice.file_path }] })
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal me-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close without saving"><X size={18} /></button>
        <h3>Invoice</h3>
        <p title={item.item}>{item.item} · {item.department}</p>

        <div className="me-section">
          <div className="me-head">
            <span>Description</span><span className="me-pay">Payment</span>
            <span className="me-num">Ex VAT</span><span className="me-vat">VAT %</span>
            <span className="me-total">Total</span><span className="me-file" /><span className="me-x" />
          </div>
          <div className="me-row">
            <input className="me-title" value={title} placeholder="Description" onChange={(e) => setTitle(e.target.value)} />
            <select className="me-pay" value={pay} onChange={(e) => setPay(e.target.value)}>
              <option value="to_be_paid">To be paid</option>
              <option value="paid_by_card">Paid by card</option>
              <option value="paid_by_bank">Paid by bank</option>
            </select>
            <input className="me-num" type="number" step="any" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} />
            <input className="me-vat" type="number" step="any" value={vat} onChange={(e) => setVat(e.target.value)} />
            <span className="me-total">{formatMoney(total)}</span>
            {file ? (
              <button className="me-file has-file" title={`${fileName} (uploads on save) — click to replace`} onClick={() => setAttaching(true)}><Paperclip size={13} /></button>
            ) : hasStoredFile ? (
              <button className="me-file" title={`View ${invoice.file_name} — click to view (use the paperclip to replace)`} onClick={() => onDownload(invoice.file_path)}><Eye size={14} /></button>
            ) : (
              <button className="me-file me-file-need" title="Attach evidence" onClick={() => setAttaching(true)}><Paperclip size={13} /></button>
            )}
            {hasStoredFile && !file ? (
              <button className="me-x" title="Replace evidence" onClick={() => setAttaching(true)}><Paperclip size={12} /></button>
            ) : (
              <span className="me-x" />
            )}
          </div>
        </div>

        <div className="me-footer">
          {needEvidence && (
            <div className="me-warn">Attach the invoice / receipt before you can save.</div>
          )}
          <div className="me-close-actions">
            <div className="me-status" style={{ flex: 1, marginBottom: 0 }}>{formatMoney(total)} incl VAT</div>
            {!isNew && <button className="btn btn-danger" disabled={saving} onClick={() => setConfirmRemove(true)}>Remove</button>}
            <button className="btn" disabled={saving} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || needEvidence} onClick={save}>Save</button>
          </div>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmModal
          open
          title="Remove this invoice?"
          message={`"${invoice.title || 'Invoice'}" and its evidence file will be removed from this line item.`}
          confirmLabel="Remove"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => { setConfirmRemove(false); remove() }}
        />
      )}
      {attaching && (
        <FileDropModal
          onSelect={(f) => { setFile(f); setFileName(f.name); setAttaching(false) }}
          onClose={() => setAttaching(false)}
        />
      )}
    </div>
  )
}
