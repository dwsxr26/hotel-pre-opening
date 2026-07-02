import { supabase } from '../supabase'

const BUCKET = 'attachments'

// Returns a map of item_id -> [{ id, filename, path, content_type }].
export async function fetchAttachments() {
  const { data, error } = await supabase
    .from('item_attachments')
    .select('item_id, attachment:attachments(id, filename, path, content_type, created_at)')
  if (error) throw error
  const map = {}
  for (const row of data ?? []) {
    if (!row.attachment) continue
    ;(map[row.item_id] ||= []).push(row.attachment)
  }
  return map
}

// Upload each file to Storage, create its metadata row, and link it to every
// given item id (many-to-many).
export async function uploadFiles(files, itemIds) {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  for (const file of files) {
    const path = `${crypto.randomUUID()}-${file.name}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (upErr) throw upErr
    const { data: att, error } = await supabase
      .from('attachments')
      .insert({ path, filename: file.name, size: file.size, content_type: file.type, uploaded_by: uid })
      .select('id')
      .single()
    if (error) throw error
    const links = itemIds.map((id) => ({ item_id: id, attachment_id: att.id }))
    if (links.length) {
      const { error: linkErr } = await supabase.from('item_attachments').insert(links)
      if (linkErr) throw linkErr
    }
  }
}

// Unlink a file from one item. If nothing else references it, delete the file.
export async function removeLink(itemId, attachmentId) {
  const { error } = await supabase
    .from('item_attachments')
    .delete()
    .eq('item_id', itemId)
    .eq('attachment_id', attachmentId)
  if (error) throw error

  const { data: remaining } = await supabase
    .from('item_attachments')
    .select('item_id')
    .eq('attachment_id', attachmentId)
    .limit(1)
  if (!remaining || remaining.length === 0) {
    const { data: att } = await supabase.from('attachments').select('path').eq('id', attachmentId).single()
    if (att?.path) await supabase.storage.from(BUCKET).remove([att.path])
    await supabase.from('attachments').delete().eq('id', attachmentId)
  }
}

// Short-lived signed URL for downloading/viewing a private file.
export async function signedUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
  if (error) throw error
  return data.signedUrl
}
