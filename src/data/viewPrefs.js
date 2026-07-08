import { supabase } from '../supabase'

// Per-user view state (sorting, filters, column widths & order) lives in the
// view_prefs table, scoped to the signed-in user by RLS. One person changing
// their sort/filters/layout never affects anyone else. `key` lets different
// views (e.g. 'orders', 'services') keep separate layouts.
export async function loadViewPrefs(key = 'orders') {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('view_prefs')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export async function saveViewPrefs(value, key = 'orders') {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  const { error } = await supabase
    .from('view_prefs')
    .upsert(
      { user_id: userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    )
  if (error) throw error
}
