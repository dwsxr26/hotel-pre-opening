import { supabase } from '../supabase'

const COLUMNS =
  'id, package, item, category, department, owner, status, qty, unit_price, supplier, order_no, est_arrival, ref, sort_index'

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

// Subscribe to changes made by other team members. Returns an unsubscribe fn.
export function subscribeItems(onChange) {
  const channel = supabase
    .channel('items-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
