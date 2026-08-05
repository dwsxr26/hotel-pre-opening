// Payment-run export: bundle every "to be paid" invoice — service invoices AND
// OS&E order invoices — into one zip (a summary CSV plus each invoice's evidence
// file) for the bookkeeper to reconcile at a payment run. A "Source" column
// distinguishes services from orders. See MonthEntriesModal / InvoicesModal
// (pay_status) + migrations 0014 and 0015.
import { zipSync, strToU8 } from 'fflate'
import { SERVICE_MONTHS } from '../lib/serviceCalc'
import { rowsToCsv } from '../lib/csv'
import { downloadServiceFileBytes, recordExportRun } from './services'

const monthLabel = (key) => SERVICE_MONTHS.find((m) => m.key === key)?.label || key || ''
const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80)
const inclVat = (p) => (Number(p.amount_ex_vat) || 0) * (1 + (Number(p.vat_pct) || 0) / 100)
const isToBePaid = (e) => (e.pay_status || 'to_be_paid') === 'to_be_paid'
const addedAfter = (e, since) => !since || (e.created_at && Date.parse(e.created_at) > since)

// Every invoice across services + orders that is still "to be paid", optionally
// only those added after `sinceTs` (an ISO timestamp). Returns a flat list of
// normalized rows: { source, id, name, department, owner, month, title, ... }.
export function collectToBePaid(lines, entriesByLine, itemsById, invoicesByItem, sinceTs = null) {
  const since = sinceTs ? Date.parse(sinceTs) : null
  const out = []

  // Service invoices.
  for (const line of lines || []) {
    for (const e of entriesByLine[line.id] || []) {
      if (e.type !== 'invoice' || !isToBePaid(e) || !addedAfter(e, since)) continue
      out.push({
        source: 'Services', id: e.id, name: line.name, department: line.department,
        owner: line.owner || '', month: monthLabel(e.month), title: e.title || '',
        amount_ex_vat: Number(e.amount_ex_vat) || 0, vat_pct: Number(e.vat_pct) || 0,
        file_path: e.file_path, file_name: e.file_name, created_at: e.created_at,
      })
    }
  }

  // OS&E order invoices.
  for (const [itemId, invoices] of Object.entries(invoicesByItem || {})) {
    const it = itemsById?.[itemId]
    for (const e of invoices || []) {
      if (!isToBePaid(e) || !addedAfter(e, since)) continue
      out.push({
        source: 'OS&E Orders', id: e.id, name: it?.item || '', department: it?.department || '',
        owner: it?.owner || '', month: '', title: e.title || '',
        amount_ex_vat: Number(e.amount_ex_vat) || 0, vat_pct: Number(e.vat_pct) || 0,
        file_path: e.file_path, file_name: e.file_name, created_at: e.created_at,
      })
    }
  }

  return out
}

export const sumEx = (picked) => picked.reduce((s, p) => s + (Number(p.amount_ex_vat) || 0), 0)

// Build and trigger the zip download, then log the run. `dateStamp` is passed in
// (YYYY-MM-DD) so this module stays free of clock calls. Returns { count, failures }.
export async function exportPaymentRun(picked, mode, dateStamp) {
  const headers = [
    'Source', 'Line / Item', 'Department', 'Owner', 'Month', 'Description',
    'Ex VAT', 'VAT %', 'Incl VAT', 'Pay status', 'Evidence file', 'Added',
  ]
  const files = {}
  const used = new Set()
  const rows = []
  const failures = []

  for (const p of picked) {
    let evidence = ''
    if (p.file_path) {
      const base = sanitize(`${p.name}-${p.month || 'order'}-${p.file_name || 'evidence'}`)
      let name = `${p.id.slice(0, 8)}-${base}`
      while (used.has(name)) name = `x-${name}`
      used.add(name)
      try {
        files[`evidence/${name}`] = await downloadServiceFileBytes(p.file_path)
        evidence = `evidence/${name}`
      } catch {
        failures.push(p.file_name || p.file_path)
        evidence = '(file missing)'
      }
    }
    rows.push([
      p.source, p.name, p.department, p.owner || '', p.month || '', p.title || '',
      Number(p.amount_ex_vat) || 0, Number(p.vat_pct) || 0, inclVat(p),
      'To be paid', evidence, (p.created_at || '').slice(0, 10),
    ])
  }

  // BOM so Excel reads UTF-8 correctly.
  files['summary.csv'] = strToU8('﻿' + rowsToCsv(headers, rows))

  const zipped = zipSync(files, { level: 0 }) // store — evidence is already compressed (PDF/JPG)
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `florence-payment-run-${dateStamp}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  await recordExportRun(mode, picked.length)
  return { count: picked.length, failures }
}
