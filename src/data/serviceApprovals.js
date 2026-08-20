import { supabase } from '../supabase'

// Over-budget (overspend) approvals for the Services module. One record per
// (line, month); reductions (Option 1) are child rows. See migration 0017.

// Returns all approvals with their reductions embedded.
export async function fetchServiceApprovals() {
  const { data, error } = await supabase
    .from('service_overspend_approvals')
    .select(
      'id, line_id, month, status, overspend_amount, method, note, requested_by, requested_at, ' +
      'approved_by, approved_at, reductions:service_overspend_reductions(id, line_id, amount)',
    )
  if (error) throw error
  return data ?? []
}

// Record (or re-open) a pending overspend for a line/month when an over-budget
// invoice is saved. Upsert on (line_id, month); re-opening clears prior approval.
export async function requestOverspend({ line_id, month, overspend_amount }) {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('service_overspend_approvals').upsert(
    {
      line_id, month, status: 'pending',
      overspend_amount: Math.round(Number(overspend_amount) || 0),
      requested_by: userData.user?.id ?? null, requested_at: new Date().toISOString(),
      method: null, note: '', approved_by: null, approved_at: null,
    },
    { onConflict: 'line_id,month' },
  )
  if (error) throw error
}

// Approve an overspend (admin only, enforced in the DB function). `method` is
// 'reallocated' (with reductions) or 'accepted' (with a written note).
export async function approveOverspend(line_id, month, method, note, reductions = []) {
  const { error } = await supabase.rpc('approve_overspend', {
    p_line_id: line_id, p_month: month, p_method: method,
    p_note: note || '', p_reductions: reductions,
  })
  if (error) throw error
}
