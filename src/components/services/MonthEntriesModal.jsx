import { useState } from 'react'
import { Eye, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS, computeLine } from '../../lib/serviceCalc'
import ConfirmModal from '../ConfirmModal'

const sumEx = (arr) => arr.reduce((s, e) => s + (Number(e.amount_ex_vat) || 0), 0)
const newKey = () => `new-${crypto.randomUUID()}`

// Blank starter row shown when a section is empty (commits to the draft on amount blur).
function DraftRow({ onCommit }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [vat, setVat] = useState(22)
  const total = (Number(amount) || 0) * (1 + (Number(vat) || 0) / 100)
  const maybeCommit = () => {
    const a = Number(amount) || 0
    if (!title.trim() && a === 0) return
    onCommit({ title: title.trim(), amount_ex_vat: a, vat_pct: Number(vat) || 0 })
    setTitle(''); setAmount(''); setVat(22)
  }
  return (
    <div className="me-row">
      <input className="me-title" value={title} placeholder="Description" onChange={(e) => setTitle(e.target.value)} />
      <input className="me-num" type="number" step="any" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} onBlur={maybeCommit} />
      <input className="me-vat" type="number" step="any" value={vat} onChange={(e) => setVat(e.target.value)} onBlur={maybeCommit} />
      <span className="me-total">{formatMoney(total)}</span><span className="me-file" /><span className="me-x" />
    </div>
  )
}

// A draft entry row (controlled by the local draft; nothing hits the DB until commit).
function EntryRow({ item, locked, onChange, onDelete, onAttach, onView }) {
  const total = (Number(item.amount_ex_vat) || 0) * (1 + (Number(item.vat_pct) || 0) / 100)
  return (
    <div className="me-row">
      <input className="me-title" value={item.title} disabled={locked} placeholder="Description" onChange={(e) => onChange('title', e.target.value)} />
      <input className="me-num" type="number" step="any" value={item.amount_ex_vat} disabled={locked} onChange={(e) => onChange('amount_ex_vat', e.target.value)} />
      <input className="me-vat" type="number" step="any" value={item.vat_pct} disabled={locked} onChange={(e) => onChange('vat_pct', e.target.value)} />
      <span className="me-total">{formatMoney(total)}</span>
      {item.type === 'invoice' && item.file_path ? (
        <button className="me-file" title={`View ${item.file_name}`} onClick={() => onView(item.file_path)}><Eye size={14} /></button>
      ) : item.type === 'invoice' && item._file ? (
        <span className="me-file" title={`${item.file_name} (uploads on save)`}><Paperclip size={13} /></span>
      ) : item.type === 'invoice' && !locked ? (
        <label className="me-file" title="Attach evidence">
          <Paperclip size={13} />
          <input type="file" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onAttach(f) }} />
        </label>
      ) : (
        <span className="me-file" />
      )}
      {locked ? <span className="me-x" /> : <button className="me-x" title="Remove" onClick={onDelete}><Trash2 size={13} /></button>}
    </div>
  )
}

export default function MonthEntriesModal({
  line, monthKey, monthLabel, entries, lineEntries, closesForLine, disposition,
  onCommit, onDownload, onReopen, onClose,
}) {
  const locked = !!disposition
  // Buffered working copy of this month's entries. Committed only on Done/Save.
  const [draft, setDraft] = useState(() => entries.map((e) => ({ ...e })))
  const [closing, setClosing] = useState(false)
  const [choice, setChoice] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [showApproval, setShowApproval] = useState(false)
  const [saving, setSaving] = useState(false)

  const forecast = draft.filter((e) => e.type === 'forecast')
  const invoices = draft.filter((e) => e.type === 'invoice')
  const forecastEx = sumEx(forecast)
  const invoicedEx = sumEx(invoices)
  const unused = forecastEx - invoicedEx
  const budget = Number(line.budget) || 0

  // Live reforecast using the buffered draft for this month.
  const simEntries = (lineEntries || [])
    .filter((e) => e.month !== monthKey)
    .concat(draft.map((d) => ({ month: monthKey, type: d.type, amount_ex_vat: d.amount_ex_vat, vat_pct: d.vat_pct })))
  const reforecastNow = computeLine(line, simEntries, closesForLine || {}, false).reforecast
  const overBudget = Math.max(0, reforecastNow - budget)

  const idx = SERVICE_MONTHS.findIndex((m) => m.key === monthKey)
  const nextMonth = SERVICE_MONTHS[idx + 1]
  const futureForecast = SERVICE_MONTHS.slice(idx + 1)
    .map((m) => ({ key: m.key, label: m.label, f: sumEx((lineEntries || []).filter((e) => e.month === m.key && e.type === 'forecast')) }))
    .filter((x) => x.f > 0)
  const futureTotal = futureForecast.reduce((s, x) => s + x.f, 0)
  const canRebalance = futureForecast.length > 0 && overBudget <= futureTotal + 0.5

  // --- draft mutators ---
  const change = (key, field, val) => setDraft((d) => d.map((x) => (x._key ?? x.id) === key ? { ...x, [field]: val } : x))
  const addRow = (type, extra = {}) => setDraft((d) => [...d, { _key: newKey(), id: null, type, title: '', amount_ex_vat: 0, vat_pct: 22, file_path: null, file_name: null, ...extra }])
  const removeRow = (key) => setDraft((d) => d.filter((x) => (x._key ?? x.id) !== key))
  const attachRow = (key, file) => setDraft((d) => d.map((x) => (x._key ?? x.id) === key ? { ...x, _file: file, file_name: file.name } : x))

  // Diff the draft against the original entries to build the commit ops.
  const buildOps = () => {
    const orig = new Map(entries.map((e) => [e.id, e]))
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
        if (d._file || Object.keys(patch).length) updates.push({ id: d.id, patch, _file: d._file })
      } else {
        adds.push({ type: d.type, title: d.title || '', amount_ex_vat: Number(d.amount_ex_vat) || 0, vat_pct: Number(d.vat_pct) || 0, _file: d._file })
      }
    }
    for (const o of entries) if (!seen.has(o.id)) deletes.push({ id: o.id, file_path: o.file_path })
    return { adds, updates, deletes }
  }

  const commit = async (closePlan = null) => {
    setSaving(true)
    try {
      await onCommit(buildOps(), closePlan)
    } finally {
      setSaving(false)
      onClose()
    }
  }

  const doClosePlan = () => {
    if (overBudget > 0.5) {
      if (!canRebalance) return
      if (choice === 'reduce-next') {
        let rem = overBudget
        const adjustments = []
        for (const m of futureForecast) {
          if (rem <= 0.5) break
          const take = Math.min(rem, m.f)
          adjustments.push({ month: m.key, amount: -take })
          rem -= take
        }
        commit({ disposition: 'reduced', adjustments })
      } else if (choice === 'reduce-prorata') {
        commit({ disposition: 'reduced', adjustments: futureForecast.map((x) => ({ month: x.key, amount: -overBudget * (x.f / futureTotal) })) })
      }
    } else if (unused > 0.5) {
      if (choice === 'cancel') commit({ disposition: 'cancelled' })
      else if (choice === 'roll') commit({ disposition: 'rolled', roll: { month: nextMonth?.key, amount: unused } })
    } else {
      commit({ disposition: 'closed' })
    }
  }

  const renderSection = (title, type, rows) => (
    <div className="me-section">
      <div className="me-section-hd"><span>{title}</span></div>
      <div className="me-head">
        <span>Description</span><span className="me-num">Ex VAT</span><span className="me-vat">VAT %</span>
        <span className="me-total">Total</span><span className="me-file" /><span className="me-x" />
      </div>
      {rows.length === 0 && !locked && <DraftRow onCommit={(vals) => addRow(type, vals)} />}
      {rows.length === 0 && locked && <div className="me-empty">None</div>}
      {rows.map((e) => {
        const key = e._key ?? e.id
        return (
          <EntryRow
            key={key} item={e} locked={locked}
            onChange={(f, v) => change(key, f, v)}
            onDelete={() => setPendingDelete(e)}
            onAttach={(file) => attachRow(key, file)}
            onView={onDownload}
          />
        )
      })}
      {!locked && (
        <button className="btn me-add" onClick={() => addRow(type)}><Plus size={13} /> Add {type === 'invoice' ? 'invoice' : 'forecast line'}</button>
      )}
    </div>
  )

  const seg = (val, label) => <button className={`seg-btn ${choice === val ? 'on' : ''}`} onClick={() => setChoice(val)}>{label}</button>

  let statusLine
  if (unused > 0.5) statusLine = `Unused this month: ${formatMoney(unused)} ex VAT`
  else if (invoicedEx > forecastEx + 0.5) statusLine = `Invoiced ${formatMoney(invoicedEx)} vs forecast ${formatMoney(forecastEx)}`
  else statusLine = 'Invoiced matches forecast.'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal me-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close without saving"><X size={18} /></button>
        <h3>{monthLabel}</h3>
        <p title={line.name}>{line.name} · {line.department}</p>
        {renderSection('Forecast', 'forecast', forecast)}
        {renderSection('Invoices', 'invoice', invoices)}

        <div className="me-footer">
          {locked ? (
            <div className="me-closed">
              <span>
                {disposition === 'cancelled' && 'Closed — unused cancelled.'}
                {disposition === 'rolled' && 'Closed — unused rolled to next month.'}
                {disposition === 'reduced' && 'Closed — future forecast reduced to stay on budget.'}
                {disposition === 'closed' && 'Closed.'}
              </span>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
              <button className="btn" disabled={saving} onClick={onReopen}>Edit</button>
            </div>
          ) : overBudget > 0.5 ? (
            <>
              <div className="me-warn">Reforecast {formatMoney(reforecastNow)} is {formatMoney(overBudget)} over budget ({formatMoney(budget)}).</div>
              {canRebalance ? (
                <>
                  <div className="me-status">Choose an option to rebalance before saving:</div>
                  <div className="me-close-actions">
                    <div className="seg">
                      {seg('reduce-next', `Reduce ${futureForecast[0].label}`)}
                      {seg('reduce-prorata', 'Reduce future pro-rata')}
                    </div>
                    <div className="spacer" />
                    <button className="btn" disabled={saving} onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!choice || saving} onClick={doClosePlan}>Save</button>
                  </div>
                </>
              ) : (
                <div className="me-close-actions">
                  <div className="me-status" style={{ flex: 1, marginBottom: 0 }}>No future forecast to rebalance against — true overspend.</div>
                  <button className="btn" disabled={saving} onClick={onClose}>Cancel</button>
                  <button className="btn btn-danger" onClick={() => setShowApproval(true)}>Request manager approval</button>
                </div>
              )}
            </>
          ) : !closing ? (
            <>
              <div className="me-status">{statusLine}</div>
              <div className="me-close-actions">
                <button className="btn btn-primary" disabled={saving} onClick={() => { setClosing(true); setChoice(null) }}>Month End Closed?</button>
                <div className="spacer" />
                <button className="btn" disabled={saving} onClick={onClose}>Cancel</button>
                <button className="btn" disabled={saving} onClick={() => commit(null)}>Save &amp; close</button>
              </div>
            </>
          ) : unused > 0.5 ? (
            <>
              <div className="me-status">Unused {formatMoney(unused)} — choose an option before saving:</div>
              <div className="me-close-actions">
                <div className="seg">
                  {seg('cancel', 'Cancel unused')}
                  {nextMonth && seg('roll', `Roll forward to ${nextMonth.label}`)}
                </div>
                <div className="spacer" />
                <button className="btn" disabled={saving} onClick={() => setClosing(false)}>Back</button>
                <button className="btn btn-primary" disabled={!choice || saving} onClick={doClosePlan}>Save</button>
              </div>
            </>
          ) : (
            <div className="me-close-actions">
              <div className="me-status" style={{ flex: 1, marginBottom: 0 }}>Invoiced matches forecast — ready to close.</div>
              <button className="btn" disabled={saving} onClick={() => setClosing(false)}>Back</button>
              <button className="btn btn-primary" disabled={saving} onClick={doClosePlan}>Save</button>
            </div>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmModal
          open
          title="Delete this entry?"
          message={`"${pendingDelete.title || (pendingDelete.type === 'invoice' ? 'Invoice' : 'Forecast line')}" will be removed from this month.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { removeRow(pendingDelete._key ?? pendingDelete.id); setPendingDelete(null) }}
        />
      )}
      {showApproval && (
        <ConfirmModal
          open
          title="Manager approval required"
          message={`This is a true overspend of ${formatMoney(overBudget)} with no future forecast to rebalance against. Manager approval is required before it can be signed off.`}
          confirmLabel="OK"
          onCancel={() => setShowApproval(false)}
          onConfirm={() => setShowApproval(false)}
        />
      )}
    </div>
  )
}
