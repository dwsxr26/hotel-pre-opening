import { supabase } from '../supabase'
import { safeName } from './attachments'

// Invoices attached to OS&E order line items. Mirrors the Services invoices
// (see data/services.js) — same shape, same attachments bucket for evidence.
const BUCKET = 'attachments'
const COLS = 'id, item_id, title, amount_ex_vat, vat_pct, pay_status, file_path, file_name, created_at'

// Returns a map of item_id -> [invoices].
export async function fetchItemInvoices() {
  const { data, error } = await supabase.from('item_invoices').select(COLS)
  if (error) throw error
  const map = {}
  for (const e of data ?? []) (map[e.item_id] ||= []).push(e)
  return map
}

export async function addItemInvoice(invoice) {
  const { data, error } = await supabase.from('item_invoices').insert(invoice).select(COLS).single()
  if (error) throw error
  return data
}

export async function updateItemInvoice(id, patch) {
  const { data, error } = await supabase.from('item_invoices').update(patch).eq('id', id).select(COLS).single()
  if (error) throw error
  return data
}

export async function deleteItemInvoice(id, filePath) {
  if (filePath) await supabase.storage.from(BUCKET).remove([filePath])
  const { error } = await supabase.from('item_invoices').delete().eq('id', id)
  if (error) throw error
}

// Upload an evidence file for an order invoice (deferred to commit, like Services).
export async function uploadInvoiceFile(file) {
  const path = `ord-${crypto.randomUUID()}-${safeName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return { path, name: file.name }
}

export async function invoiceSignedUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
  if (error) throw error
  return data.signedUrl
}
