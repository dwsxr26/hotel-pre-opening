import { supabase } from '../supabase'

const BUCKET = 'attachments'
const ENTRY_COLS = 'id, line_id, month, type, title, amount_ex_vat, vat_pct, file_path, file_name'

export async function fetchServiceLines() {
  const { data, error } = await supabase
    .from('service_lines')
    .select('id, name, department, owner, budget, sort_index')
    .order('sort_index', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Returns a map of line_id -> [entries].
export async function fetchServiceEntries() {
  const { data, error } = await supabase
    .from('service_entries')
    .select('id, line_id, month, type, title, amount_ex_vat, vat_pct, file_path, file_name')
  if (error) throw error
  const map = {}
  for (const e of data ?? []) (map[e.line_id] ||= []).push(e)
  return map
}

// Returns a map of line_id -> Set(monthKey) of closed months.
export async function fetchServiceCloses() {
  const { data, error } = await supabase.from('service_month_close').select('line_id, month, disposition')
  if (error) throw error
  const map = {}
  for (const c of data ?? []) (map[c.line_id] ||= new Set()).add(c.month)
  return map
}

// --- entries (forecast breakdown + invoices) -------------------------------
export async function addServiceEntry(entry) {
  const { data, error } = await supabase.from('service_entries').insert(entry).select(ENTRY_COLS).single()
  if (error) throw error
  return data
}

export async function updateServiceEntry(id, patch) {
  const { data, error } = await supabase.from('service_entries').update(patch).eq('id', id).select(ENTRY_COLS).single()
  if (error) throw error
  return data
}

export async function deleteServiceEntry(id, filePath) {
  if (filePath) await supabase.storage.from(BUCKET).remove([filePath])
  const { error } = await supabase.from('service_entries').delete().eq('id', id)
  if (error) throw error
}

// --- invoice files (reuse the attachments bucket) --------------------------
export async function uploadServiceFile(file) {
  const path = `svc-${crypto.randomUUID()}-${file.name}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return { path, name: file.name }
}

export async function serviceSignedUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
  if (error) throw error
  return data.signedUrl
}

// --- month close (cancel / roll forward) -----------------------------------
export async function setMonthClose(line_id, month, disposition) {
  const { error } = await supabase
    .from('service_month_close')
    .upsert({ line_id, month, disposition }, { onConflict: 'line_id,month' })
  if (error) throw error
}

export async function clearMonthClose(line_id, month) {
  const { error } = await supabase.from('service_month_close').delete().eq('line_id', line_id).eq('month', month)
  if (error) throw error
}
