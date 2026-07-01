// Departments the team allocates spend against.
export const DEPARTMENTS = ['Marketing', 'Legal', 'HR', 'OS&E', 'F&B', 'Corporate']

// Auto-allocate a department from an item's category (and item name as a tie-breaker).
// This is a best-effort default applied at seed time; any row can be overridden
// in the app via the Department dropdown, and that choice is what gets stored.
//
// Rules are checked in priority order — the first match wins:
//   1. Anything "branded" or marketing-facing (signage, uniforms, stationery) -> Marketing
//   2. Office / corporate supplies -> Corporate
//   3. Food & beverage operations (kitchen, bar, tabletop, coffee, POS) -> F&B
//   4. Everything else (furniture, FF&E, toiletries, decoration, fees) -> OS&E
//
// Legal and HR have no reliable signal in the source data, so they are never
// auto-assigned — they exist in the dropdown for manual allocation.
export function allocateDepartment(category = '', item = '') {
  const hay = `${category} ${item}`.toLowerCase()

  const has = (...needles) => needles.some((n) => hay.includes(n))

  // 1. Marketing — branding & guest-facing communication
  if (has('brand', 'signage', 'uniform')) return 'Marketing'

  // 2. Corporate — back-office / administrative
  if (has('office', 'stationary', 'stationery')) return 'Corporate'

  // 3. F&B — food & beverage service and production
  if (
    has(
      'f&b', 'kitchen', 'bar', 'stewarding', 'chinaware', 'cutlery',
      'glassware', 'coffee', 'grab & go', 'pos system', 'presentation',
      'fridge', 'freezer', 'beverage', 'nespresso', 'crockery', 'tableware',
    )
  ) {
    return 'F&B'
  }

  // 4. OS&E — operating supplies & equipment (default)
  return 'OS&E'
}
