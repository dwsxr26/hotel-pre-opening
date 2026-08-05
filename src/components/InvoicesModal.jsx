import { useState } from 'react'
import { Eye, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { formatMoney } from '../lib/format'
import ConfirmModal from './ConfirmModal'
import FileDropModal from './services/FileDropModal'

// Invoices for a single OS&E order line item. Ported from the Services
// MonthEntriesModal invoice section, minus the forecast / month-close machinery
// (order lines have no monthly forecast). Buffered: nothing hits the DB until
// Save, and evidence files upload on commit (so a cancelled modal leaves no
// orphans). Every invoice must carry evidence before it can be saved.
const sumEx = (arr) => arr.reduce((s, e) => s + (Number(e.amount_ex_vat) || 0), 0)
const newKey = () => `new-${crypto.randomUUID()}`

function PayCell({ value, onChange }) {
  return (
    <select className="me-pay" value={value || 'to_be_paid'} onChange={(e) => onChange(e.target.value)}>
      <option value="to_be_paid">To be paid</option>
      <option value="paid_by_card">Paid by card</option>
      <option value="paid_by_bank">Paid by bank</option>
    </select>
  )
}

// Blank starter row shown when there are no invoices yet (commits to the draft
// on amount blur).
function DraftRow({ onCommit }) {
  const [title, setTitle] = useState('')
  const [pay, setPay] = useState('to_be_paid')
  const [amount, setAmount] = useState('')
  const [vat, setVat] = useState(22)
  const total = (Number(amount) || 0) * (1 + (Number(vat) || 0) / 100)
  const maybeCommit = () => {
    const a = Number(amount) || 0
    if (!title.trim() && a === 0) return
    onCommit({ title: title.trim(), pay_status: pay, amount_ex_vat: a, vat_pct: Number(vat) || 0 })
    setTitle(''); setPay('to_be_paid'); setAmount(''); setVat(22)
  }
  return (
    <div className="me-row">
      <input className="me-title" value={title} placeholder="Description" onChange={(e) => setTitle(e.target.value)} />
      <PayCell value={pay} onChange={setPay} />
      <input className="me-num" type="number" step="any" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} onBlur={maybeCommit} />
      <input className="me-vat" type="number" step="any" value={vat} onChange={(e) => setVat(e.target.value)} onBlur={maybeCommit} />
      <span className="me-total">{formatMoney(total)}</span><span className="me-file" /><span className="me-x" />
    </div>
  )
}

function EntryRow({ item, onChange, onDelete, onAttachClick, onView }) {
  const total = (Number(item.amount_ex_vat) || 0) * (1 + (Number(item.vat_pct) || 0) / 100)
  return (
    <div className="me-row">
      <input className="me-title" value={item.title} placeholder="Description" onChange={(e) => onChange('title', e.target.value)} />
      <PayCell value={item.pay_status} onChange={(v) => onChange('pay_status', v)} />
      <input className="me-num" type="number" step="any" value={item.amount_ex_vat} onChange={(e) => onChange('amount_ex_vat', e.target.value)} />
      <input className="me-vat" type="number" step="any" value={item.vat_pct} onChange={(e) => onChange('vat_pct', e.target.value)} />
      <span className="me-total">{formatMoney(total)}</span>
      {item.file_path ? (
        <button className="me-file" title={`View ${item.file_name}`} onClick={() => onView(item.file_path)}><Eye size={14} /></button>
      ) : item._file ? (
        <button className="me-file has-file" title={`${item.file_name} (uploads on save) — click to replace`} onClick={onAttachClick}><Paperclip size={13} /></button>
      ) : (
        <button className="me-file me-file-need" title="Attach evidence" onClick={onAttachClick}><Paperclip size={13} /></button>
      )}
      <button className="me-x" title="Remove" onClick={onDelete}><Trash2 size={13} /></button>
    </div>
  )
}

export default function InvoicesModal({ item, invoices, onCommit, onDownload, onClose }) {
  const [draft, setDraft] = useState(() => invoices.map((e) => ({ ...e })))
  const [pendingDelete, setPendingDelete] = useState(null)
  const [saving, setSaving] = useState(false)
  const [attachKey, setAttachKey] = useState(null)

  const invoicedEx = sumEx(draft)
  // Every invoice must have evidence (an existing file or a pending upload).
  const missingEvidence = draft.some((e) => !e.file_path && !e._file)

  const change = (key, field, val) => setDraft((d) => d.map((x) => (x._key ?? x.id) === key ? { ...x, [field]: val } : x))
  const addRow = (extra = {}) => setDraft((d) => [...d, { _key: newKey(), id: null, title: '', pay_status: 'to_be_paid', amount_ex_vat: 0, vat_pct: 22, file_path: null, file_name: null, ...extra }])
  const removeRow = (key) => setDraft((d) => d.filter((x) => (x._key ?? x.id) !== key))
  const attachRow = (key, file) => setDraft((d) => d.map((x) => (x._key ?? x.id) === key ? { ...x, _file: file, file_name: file.name } : x))

  // Diff the draft against the original invoices to build the commit ops.
  const buildOps = () => {
    const orig = new Map(invoices.map((e) => [e.id, e]))
    const adds = []
    const updates = []
    const deletes = []
    const seen = new Set()
    for (const d of draft) {
      if (d.id) {
        seen.add(d.id)
        const o = orig.get(d.id)
        const patch = {}
        if ((d.title || '') !== (o.title || '')) patch.title = d.title || ''
        if ((Number(d.amount_ex_vat) || 0) !== (Number(o.amount_ex_vat) || 0)) patch.amount_ex_vat = Number(d.amount_ex_vat) || 0
        if ((Number(d.vat_pct) || 0) !== (Number(o.vat_pct) || 0)) patch.vat_pct = Number(d.vat_pct) || 0
        if ((d.pay_status || 'to_be_paid') !== (o.pay_status || 'to_be_paid')) patch.pay_status = d.pay_status || 'to_be_paid'
        if (d._file || Object.keys(patch).length) updates.push({ id: d.id, patch, _file: d._file })
      } else {
        adds.push({ title: d.title || '', pay_status: d.pay_status || 'to_be_paid', amount_ex_vat: Number(d.amount_ex_vat) || 0, vat_pct: Number(d.vat_pct) || 0, _file: d._file })
      }
    }
    for (const o of invoices) if (!seen.has(o.id)) deletes.push({ id: o.id, file_path: o.file_path })
    return { adds, updates, deletes }
  }

  const commit = async () => {
    if (missingEvidence || saving) return
    setSaving(true)
    try {
      await onCommit(buildOps())
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal me-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close without saving"><X size={18} /></button>
        <h3>Invoices</h3>
        <p title={item.item}>{item.item} · {item.department}</p>

        <div className="me-section">
          <div className="me-head">
            <span>Description</span><span className="me-pay">Payment</span>
            <span className="me-num">Ex VAT</span><span className="me-vat">VAT %</span>
            <span className="me-total">Total</span><span className="me-file" /><span className="me-x" />
          </div>
          {draft.length === 0 && <DraftRow onCommit={(vals) => addRow(vals)} />}
          {draft.map((e) => {
            const key = e._key ?? e.id
            return (
              <EntryRow
                key={key} item={e}
                onChange={(f, v) => change(key, f, v)}
                onDelete={() => setPendingDelete(e)}
                onAttachClick={() => setAttachKey(key)}
                onView={onDownload}
              />
            )
          })}
          <button className="btn me-add" onClick={() => addRow()}><Plus size={13} /> Add invoice</button>
        </div>

        <div className="me-footer">
          {missingEvidence && (
            <div className="me-warn">Attach evidence to every invoice before you can save.</div>
          )}
          <div className="me-close-actions">
            <div className="me-status" style={{ flex: 1, marginBottom: 0 }}>
              {draft.length === 0 ? 'No invoices yet.' : `${draft.length} invoice${draft.length === 1 ? '' : 's'} · ${formatMoney(invoicedEx)} ex VAT`}
            </div>
            <button className="btn" disabled={saving} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || missingEvidence} onClick={commit}>Save</button>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmModal
          open
          title="Delete this invoice?"
          message={`"${pendingDelete.title || 'Invoice'}" will be removed from this line item.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { removeRow(pendingDelete._key ?? pendingDelete.id); setPendingDelete(null) }}
        />
      )}
      {attachKey != null && (
        <FileDropModal
          onSelect={(file) => { attachRow(attachKey, file); setAttachKey(null) }}
          onClose={() => setAttachKey(null)}
        />
      )}
    </div>
  )
}
