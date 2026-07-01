import { supabase } from '../supabase'

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Add a category from the in-dropdown "+ Add category" flow. Idempotent: an
// existing name is returned rather than duplicated.
export async function addCategory(name) {
  const trimmed = name.trim()
  if (!trimmed) return null
  const { data, error } = await supabase
    .from('categories')
    .upsert({ name: trimmed }, { onConflict: 'name' })
    .select('id, name')
    .single()
  if (error) throw error
  return data
}
