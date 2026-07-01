// Display a profile as "First L." (first name + last-name initial), e.g.
// { first_name: 'Diederik', last_name: 'Scholten' } -> "Diederik S.".
// Falls back to the email local-part when no name is set yet.
export function displayName(profile) {
  if (!profile) return ''
  const first = (profile.first_name || '').trim()
  const last = (profile.last_name || '').trim()
  if (!first && !last) return (profile.email || '').split('@')[0]
  return `${first}${last ? ` ${last[0].toUpperCase()}.` : ''}`.trim()
}
