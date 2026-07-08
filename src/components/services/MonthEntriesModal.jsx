import { useState } from 'react'
import { Download, Eye, Paperclip, Plus, Trash2, X } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { SERVICE_MONTHS, computeLine } from '../../lib/serviceCalc'

// Blank starter row shown when a section has no entries yet.
function DraftRow({ onCommit }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [vat, setVat] = useState(22)
  const total = (Number(amount) || 0) * (1 + (Number(vat) || 0) / 100)
  const maybeCommit = () => {
    const a = Number(amount) || 0
    if (!title.trim() && a === 0) return
    onCommit({ title: title.trim(), amount_ex_vat: a, vat_pct: Number(vat) || 0 })
    setTitle('')
    setAmount('')
    setVat(22)
  }
  return (
    <div className="me-row">
      <input className="me-title" value={title} placeholder="Description" onChange={(e) => setTitle(e.target.value)} />
      <input className="me-num" type="number" step="any" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} onBlur={maybeCommit} />
      <input className="me-vat" type="number" step="any" value={vat} onChange={(e) => setVat(e.target.value)} onBlur={maybeCommit} />
      <span className="me-total">{formatMoney(total)}</span>
      <span className="me-file" />
      <span className="me-x" />
    </div>
  )
}

// Editable entry row (controlled; reverts on a blocked edit).
function EntryRow({ entry, onUpdate, onDelete, onAttach, onDownload }) {
  const [title, setTitle] = useState(entry.title)
  const [amount, setAmount] = useState(entry.amount_ex_vat)
  const [vat, setVat] = useState(entry.vat_pct)
  const commit = async (field, val, reset) => {
    if (String(val) === String(entry[field] ?? '')) return
    const ok = await onUpdate(entry.id, { [field]: val })
    if (ok === false) reset()
  }
  const total = (Number(amount) || 0) * (1 + (Number(vat) || 0) / 100)
  return (
    <div className="me-row">
      <input className="me-title" value={title} placeholder="Description" onChange={(e) => setTitle(e.target.value)} onBlur={() => commit('title', title, () => setTitle(entry.title))} />
      <input className="me-num" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => commit('amount_ex_vat', Number(amount) || 0, () => setAmount(entry.amount_ex_vat))} />
      <input className="me-vat" type="number" step="any" value={vat} onChange={(e) => setVat(e.target.value)} onBlur={() => commit('vat_pct', Number(vat) || 0, () => setVat(entry.vat_pct))} />
      <span className="me-total">{formatMoney(total)}</span>
      {entry.type === 'invoice' && entry.file_path ? (
        <button className="me-file" title={`View ${entry.file_name}`} onClick={() => onDownload(entry.file_path)}><Download size={13} /></button>
      ) : entry.type === 'invoice' ? (
        <FileAttach onAttach={(f) => onAttach(entry, f)} />
      ) : (
        <span className="me-file" />
      )}
      <button className="me-x" title="Remove" onClick={() => onDelete(entry.id, entry.file_path)}><Trash2 size={13} /></button>
    </div>
  )
}

function FileAttach({ onAttach }) {
  return (
    <label className="me-file" title="Attach evidence">
      <Paperclip size={13} />
      <input type="file" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onAttach(f) }} />
    </label>
  )
}

const sumEx = (arr) => arr.reduce((s, e) => s + (Number(e.amount_ex_vat) || 0), 0)

export default function MonthEntriesModal({
  line, monthKey, monthLabel, entries, lineEntries, closesForLine, disposition,
  onAdd, onUpdate, onDelete, onAttach, onDownload, onSave, onReopen, onClose,
}) {
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState(false)
  const [choice, setChoice] = useState(null)

  const forecast = entries.filter((e) => e.type === 'forecast')
  const invoices = entries.filter((e) => e.type === 'invoice')
  const forecastEx = sumEx(forecast)
  const invoicedEx = sumEx(invoices)
  const unused = forecastEx - invoicedEx
  const budget = Number(line.budget) || 0
  const reforecastIfClosed = computeLine(line, lineEntries, { ...(closesForLine || {}), [monthKey]: 'closed' }, false).reforecast
  const overBudget = Math.max(0, reforecastIfClosed - budget)

  const idx = SERVICE_MONTHS.findIndex((m) => m.key === monthKey)
  const nextMonth = SERVICE_MONTHS[idx + 1]
  const futureForecast = SERVICE_MONTHS.slice(idx + 1)
    .map((m) => ({ key: m.key, label: m.label, f: sumEx((lineEntries || []).filter((e) => e.month === m.key && e.type === 'forecast')) }))
    .filter((x) => x.f > 0)

  const invoiceFiles = invoices.filter((e) => e.file_path)

  const add = async (type, extra = {}) => {
    setBusy(true)
    try {
      await onAdd({ line_id: line.id, month: monthKey, type, title: '', amount_ex_vat: 0, vat_pct: 22, ...extra })
    } finally {
      setBusy(false)
    }
  }

  const doSave = () => {
    let plan
    if (overBudget > 0.5 && futureForecast.length > 0) {
      if (choice === 'reduce-next') plan = { disposition: 'reduced', adjustments: [{ month: futureForecast[0].key, amount: -overBudget }] }
      else if (choice === 'reduce-prorata') {
        const T = futureForecast.reduce((s, x) => s + x.f, 0)
        plan = { disposition: 'reduced', adjustments: futureForecast.map((x) => ({ month: x.key, amount: -overBudget * (x.f / T) })) }
      } else return
    } else if (unused > 0.5) {
      if (choice === 'cancel') plan = { disposition: 'cancelled' }
      else if (choice === 'roll') plan = { disposition: 'rolled', roll: { month: nextMonth?.key, amount: unused } }
      else return
    } else {
      plan = { disposition: 'closed' }
    }
    onSave(plan)
    setClosing(false)
    setChoice(null)
  }

  const renderSection = (title, type, rows) => (
    <div className="me-section">
      <div className="me-section-hd"><span>{title}</span></div>
      <div className="me-head">
        <span>Description</span><span className="me-num">Ex VAT</span><span className="me-vat">VAT %</span>
        <span className="me-total">Total</span><span className="me-file" /><span className="me-x" />
      </div>
      {rows.length === 0 && <DraftRow onCommit={(vals) => add(type, vals)} />}
      {rows.map((e) => (
        <EntryRow
          key={`${e.id}:${e.amount_ex_vat}:${e.vat_pct}:${e.title}:${e.file_path || ''}`}
          entry={e} onUpdate={onUpdate} onDelete={onDelete} onAttach={onAttach} onDownload={onDownload}
        />
      ))}
      <button className="btn me-add" disabled={busy} onClick={() => add(type)}>
        <Plus size={13} /> Add {type === 'invoice' ? 'invoice' : 'forecast line'}
      </button>
    </div>
  )

  const seg = (val, label) => (
    <button className={`seg-btn ${choice === val ? 'on' : ''}`} onClick={() => setChoice(val)}>{label}</button>
  )

  // Status line shown above the action buttons.
  let statusLine
  if (unused > 0.5) statusLine = `Unused this month: ${formatMoney(unused)} ex VAT`
  else if (invoicedEx > forecastEx + 0.5) statusLine = `Invoiced ${formatMoney(invoicedEx)} vs forecast ${formatMoney(forecastEx)}${overBudget > 0.5 ? ` — ${formatMoney(overBudget)} over budget` : ' — within budget'}`
  else statusLine = 'Invoiced matches forecast.'

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal me-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={onClose} title="Close"><X size={18} /></button>
        <h3>{monthLabel}</h3>
        <p title={line.name}>{line.name} · {line.department}</p>
        {renderSection('Forecast', 'forecast', forecast)}
        {renderSection('Invoices', 'invoice', invoices)}

        {invoiceFiles.length > 0 && (
          <div className="me-viewbar">
            <button className="btn" onClick={() => invoiceFiles.forEach((e) => onDownload(e.file_path))} title="Open the attached invoice(s) in a new tab">
              <Eye size={14} /> View invoice{invoiceFiles.length > 1 ? `s (${invoiceFiles.length})` : ''}
            </button>
          </div>
        )}

        <div className="me-footer">
          {disposition ? (
            <div className="me-closed">
              <span>
                {disposition === 'cancelled' && 'Closed — unused cancelled.'}
                {disposition === 'rolled' && 'Closed — unused rolled to next month.'}
                {disposition === 'reduced' && 'Closed — future forecast reduced to stay on budget.'}
                {disposition === 'closed' && 'Closed.'}
              </span>
              <button className="btn" onClick={onReopen}>Edit</button>
            </div>
          ) : !closing ? (
            <>
              <div className="me-status">{statusLine}</div>
              <div className="me-close-actions">
                <button className="btn btn-primary" onClick={() => { setClosing(true); setChoice(null) }}>Month End Closed?</button>
                <div className="spacer" />
                <button className="btn" onClick={onClose}>Done</button>
              </div>
            </>
          ) : (
            <>
              <div className="me-status">{statusLine}</div>
              {overBudget > 0.5 && futureForecast.length > 0 ? (
                <>
                  <div className="me-status">Rebalance {formatMoney(overBudget)} across future months:</div>
                  <div className="me-close-actions">
                    <div className="seg">
                      {seg('reduce-next', `Reduce ${futureForecast[0].label}`)}
                      {seg('reduce-prorata', 'Reduce future pro-rata')}
                    </div>
                    <div className="spacer" />
                    <button className="btn" onClick={() => setClosing(false)}>Back</button>
                    <button className="btn btn-primary" disabled={!choice} onClick={doSave}>Save</button>
                  </div>
                </>
              ) : unused > 0.5 ? (
                <div className="me-close-actions">
                  <div className="seg">
                    {seg('cancel', 'Cancel unused')}
                    {nextMonth && seg('roll', `Roll forward to ${nextMonth.label}`)}
                  </div>
                  <div className="spacer" />
                  <button className="btn" onClick={() => setClosing(false)}>Back</button>
                  <button className="btn btn-primary" disabled={!choice} onClick={doSave}>Save</button>
                </div>
              ) : (
                <div className="me-close-actions">
                  <div className="spacer" />
                  <button className="btn" onClick={() => setClosing(false)}>Back</button>
                  <button className="btn btn-primary" onClick={doSave}>Save</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
