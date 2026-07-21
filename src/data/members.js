import { supabase } from '../supabase'

// The invite allowlist: only emails in this table can create an account, and
// only they can see any data. Admins manage it from the Team modal.

export async function fetchAllowedMembers() {
  const { data, error } = await supabase
    .from('allowed_members')
    .select('email, created_at')
    .order('email', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Admins only (enforced by RLS).
export async function addAllowedMember(email) {
  const { data: userData } = await supabase.auth.getUser()
  const row = { email: email.trim().toLowerCase(), added_by: userData.user?.id ?? null }
  const { data, error } = await supabase
    .from('allowed_members')
    .insert(row)
    .select('email, created_at')
    .single()
  if (error) throw error
  return data
}

export async function removeAllowedMember(email) {
  const { error } = await supabase.from('allowed_members').delete().eq('email', email)
  if (error) throw error
}
