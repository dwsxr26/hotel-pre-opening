import { supabase } from '../supabase'

const COLUMNS =
  'id, package, item, category, department, owner, status, qty, unit_price, supplier, order_date, invoice_no, order_no, est_arrival, ref, sort_index'

export async function fetchItems() {
  const { data, error } = await supabase
    .from('items')
    .select(COLUMNS)
    .order('sort_index', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Patch is a partial row, e.g. { status: 'Order placed' }.
export async function updateItem(id, patch) {
  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw error
  return data
}

// Insert a new (blank) line item.
export async function addItem(patch) {
  const { data, error } = await supabase.from('items').insert(patch).select(COLUMNS).single()
  if (error) throw error
  return data
}

// Apply the same patch to many items at once (bulk edit).
export async function updateItems(ids, patch) {
  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .in('id', ids)
    .select(COLUMNS)
  if (error) throw error
  return data ?? []
}

// Delete line items.
export async function deleteItems(ids) {
  const { error } = await supabase.from('items').delete().in('id', ids)
  if (error) throw error
}

// Subscribe to changes made by other team members. Returns an unsubscribe fn.
export function subscribeItems(onChange) {
  const channel = supabase
    .channel('items-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
