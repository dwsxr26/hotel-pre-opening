import { supabase } from '../supabase'

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
