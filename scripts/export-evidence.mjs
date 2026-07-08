// Download all evidence files (Orders attachments + Services invoices) with
// meaningful names, plus a manifest.csv index. Run locally:
//   npm run export:evidence
// Output goes to ./evidence/ (git-ignored).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const BUCKET = 'attachments'

const OUT = 'evidence'
const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)
const csvEsc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const monthLabel = (d) => {
  if (!d) return ''
  const dt = new Date(`${d}T00:00:00Z`)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

async function download(path, dest) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  const buf = Buffer.from(await data.arrayBuffer())
  writeFileSync(dest, buf)
  return buf.length
}

async function main() {
  mkdirSync(join(OUT, 'orders'), { recursive: true })
  mkdirSync(join(OUT, 'services'), { recursive: true })
  const manifest = [
    ['Source', 'SavedAs', 'OriginalName', 'Department', 'Line / Item', 'Supplier', 'Invoice #', 'Order #', 'Month', 'Amount ex VAT', 'VAT %', 'StoragePath'],
  ]
  let ok = 0
  let fail = 0

  // --- Orders attachments (many-to-many with items) ------------------------
  const { data: links, error: linkErr } = await supabase
    .from('item_attachments')
    .select('attachment:attachments(id, file_name:filename, path), item:items(item, department, supplier, invoice_no, order_no)')
  if (linkErr) throw linkErr

  // Group by attachment so a shared file downloads once.
  const byAtt = new Map()
  for (const row of links ?? []) {
    if (!row.attachment) continue
    const a = row.attachment
    if (!byAtt.has(a.id)) byAtt.set(a.id, { att: a, items: [] })
    if (row.item) byAtt.get(a.id).items.push(row.item)
  }
  for (const { att, items } of byAtt.values()) {
    const saved = `orders/${att.id.slice(0, 8)}-${sanitize(att.file_name)}`
    try {
      await download(att.path, join(OUT, saved))
      ok++
      const it = items[0] || {}
      manifest.push([
        'Orders', saved, att.file_name, it.department || '',
        items.map((x) => x.item).join(' | '), it.supplier || '', it.invoice_no || '', it.order_no || '',
        '', '', '', att.path,
      ])
    } catch (e) {
      fail++
      console.error('Failed:', att.path, e.message)
    }
  }

  // --- Services invoices ---------------------------------------------------
  const { data: entries, error: entErr } = await supabase
    .from('service_entries')
    .select('id, file_path, file_name, month, amount_ex_vat, vat_pct, line:service_lines(name, department)')
    .eq('type', 'invoice')
    .not('file_path', 'is', null)
  if (entErr) throw entErr

  for (const e of entries ?? []) {
    const line = e.line || {}
    const desc = sanitize(`${line.department || ''} - ${line.name || ''} - ${monthLabel(e.month)} - ${e.file_name}`)
    const saved = `services/${e.id.slice(0, 8)}-${desc}`
    try {
      await download(e.file_path, join(OUT, saved))
      ok++
      manifest.push([
        'Services', saved, e.file_name, line.department || '', line.name || '', '', '', '',
        monthLabel(e.month), e.amount_ex_vat, e.vat_pct, e.file_path,
      ])
    } catch (err) {
      fail++
      console.error('Failed:', e.file_path, err.message)
    }
  }

  writeFileSync(join(OUT, 'manifest.csv'), '﻿' + manifest.map((r) => r.map(csvEsc).join(',')).join('\n'))
  console.log(`\nDone. Downloaded ${ok} file(s)${fail ? `, ${fail} failed` : ''}.`)
  console.log(`See ./${OUT}/manifest.csv and the orders/ + services/ folders.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
