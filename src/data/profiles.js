import { supabase } from '../supabase'

const COLUMNS = 'user_id, email, first_name, last_name, password_set, is_admin'

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

// Admins only (enforced by RLS): promote/demote another user.
export async function setAdmin(userId, isAdmin) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('user_id', userId)
    .select(COLUMNS)
    .single()
  if (error) throw error
  return data
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

// Set the signed-in user's password (works because they already have a session
// from the magic link) and record that they've set one.
export async function setMyPassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  const { data: userData } = await supabase.auth.getUser()
  const { data, error: e2 } = await supabase
    .from('profiles')
    .update({ password_set: true })
    .eq('user_id', userData.user.id)
    .select(COLUMNS)
    .single()
  if (e2) throw e2
  return data
}
