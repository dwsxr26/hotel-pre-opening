import { lineTotal } from './format'

const HEADERS = [
  'Package', 'Item', 'Category', 'Department', 'Owner', 'Status', 'Qty',
  'Unit price', 'Total', 'Supplier', 'Order date', 'Invoice #', 'Order #', 'Est. arrival', 'Description/ref',
]

const esc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Build a CSV string from item rows (plain objects).
export function itemsToCsv(rows) {
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.package, r.item, r.category, r.department, r.owner, r.status, r.qty,
        r.unit_price, lineTotal(r), r.supplier, r.order_date || '', r.invoice_no, r.order_no,
        r.est_arrival || '', r.ref,
      ]
        .map(esc)
        .join(','),
    )
  }
  return lines.join('\n')
}

// Trigger a client-side download of a CSV file.
export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
