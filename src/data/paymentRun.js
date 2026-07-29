// Payment-run export: bundle every "to be paid" service invoice into one zip —
// a summary CSV plus each invoice's evidence file — for the bookkeeper to
// reconcile at a payment run. See MonthEntriesModal (pay_status) + migration 0014.
import { zipSync, strToU8 } from 'fflate'
import { SERVICE_MONTHS } from '../lib/serviceCalc'
import { rowsToCsv } from '../lib/csv'
import { downloadServiceFileBytes, recordExportRun } from './services'

const monthLabel = (key) => SERVICE_MONTHS.find((m) => m.key === key)?.label || key
const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80)
const inclVat = (e) => (Number(e.amount_ex_vat) || 0) * (1 + (Number(e.vat_pct) || 0) / 100)

// Every invoice across `lines` that is still "to be paid", optionally only those
// added after `sinceTs` (an ISO timestamp). Returns [{ entry, line }].
export function collectToBePaid(lines, entriesByLine, sinceTs = null) {
  const since = sinceTs ? Date.parse(sinceTs) : null
  const out = []
  for (const line of lines) {
    for (const e of entriesByLine[line.id] || []) {
      if (e.type !== 'invoice') continue
      if ((e.pay_status || 'to_be_paid') !== 'to_be_paid') continue
      if (since && !(e.created_at && Date.parse(e.created_at) > since)) continue
      out.push({ entry: e, line })
    }
  }
  return out
}

export const sumEx = (picked) => picked.reduce((s, p) => s + (Number(p.entry.amount_ex_vat) || 0), 0)

// Build and trigger the zip download, then log the run. `dateStamp` is passed in
// (YYYY-MM-DD) so this module stays free of clock calls. Returns { count, failures }.
export async function exportPaymentRun(picked, mode, dateStamp) {
  const headers = [
    'Line', 'Department', 'Owner', 'Month', 'Description',
    'Ex VAT', 'VAT %', 'Incl VAT', 'Pay status', 'Evidence file', 'Added',
  ]
  const files = {}
  const used = new Set()
  const rows = []
  const failures = []

  for (const { entry, line } of picked) {
    let evidence = ''
    if (entry.file_path) {
      const base = sanitize(`${line.name}-${monthLabel(entry.month)}-${entry.file_name || 'evidence'}`)
      let name = `${entry.id.slice(0, 8)}-${base}`
      while (used.has(name)) name = `x-${name}`
      used.add(name)
      try {
        files[`evidence/${name}`] = await downloadServiceFileBytes(entry.file_path)
        evidence = `evidence/${name}`
      } catch {
        failures.push(entry.file_name || entry.file_path)
        evidence = '(file missing)'
      }
    }
    rows.push([
      line.name, line.department, line.owner || '', monthLabel(entry.month), entry.title || '',
      Number(entry.amount_ex_vat) || 0, Number(entry.vat_pct) || 0, inclVat(entry),
      'To be paid', evidence, (entry.created_at || '').slice(0, 10),
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
