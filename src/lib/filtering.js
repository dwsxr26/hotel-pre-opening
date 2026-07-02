// Shared filter logic so the grid and the Metrics panel agree on what's
// "currently filtered". Filter values match the grid's shape:
//   { type: 'set', values: [...] } | { type: 'text', text: '...' }

export function itemMatches(item, columnFilters, globalFilter) {
  for (const f of columnFilters || []) {
    const v = f.value
    if (!v) continue
    const cell = item[f.id] == null ? '' : String(item[f.id])
    if (v.type === 'set') {
      if (!v.values.includes(cell)) return false
    } else if (v.type === 'text') {
      if (!cell.toLowerCase().includes((v.text || '').toLowerCase())) return false
    }
  }
  const q = (globalFilter || '').toLowerCase()
  if (q) {
    const hay = [
      item.item, item.supplier, item.order_no, item.invoice_no, item.ref,
      item.category, item.package, item.department, item.owner,
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

export function filterItems(items, columnFilters, globalFilter) {
  return items.filter((i) => itemMatches(i, columnFilters, globalFilter))
}
