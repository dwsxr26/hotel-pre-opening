import { supabase } from '../supabase'

export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Add a department from the in-dropdown "+ Add department" flow (idempotent).
export async function addDepartment(name) {
  const trimmed = name.trim()
  if (!trimmed) return null
  const { data, error } = await supabase
    .from('departments')
    .upsert({ name: trimmed }, { onConflict: 'name' })
    .select('id, name')
    .single()
  if (error) throw error
  return data
}
