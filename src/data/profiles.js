import { supabase } from '../supabase'

const COLUMNS = 'user_id, email, first_name, last_name'

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .order('first_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Make sure the signed-in user has a profile row; create an empty one if not.
export async function ensureMyProfile() {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  if (data) return data

  const row = { user_id: user.id, email: user.email, first_name: '', last_name: '' }
  const { data: inserted, error: insErr } = await supabase.from('profiles').insert(row).select(COLUMNS).single()
  if (insErr) throw insErr
  return inserted
}

export async function updateMyProfile({ first_name, last_name }) {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .update({ first_name: first_name.trim(), last_name: last_name.trim() })
    .eq('user_id', user.id)
    .select(COLUMNS)
    .single()
  if (error) throw error
  return data
}
