// Formatting helpers shared across the grid and summaries.

const eur = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const eur2 = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const intFmt = new Intl.NumberFormat('en-IE')

// Money: €0 (or empty) renders as "-", everything else as a whole-euro amount.
export function formatMoney(value) {
  const n = Number(value)
  if (!n) return '-'
  return eur.format(n)
}

// Money to 2 decimals: €0 (or empty) renders as "-", everything else with cents.
export function formatMoney2(value) {
  const n = Number(value)
  if (!n) return '-'
  return eur2.format(n)
}

// Plain integer with thousands separators (for counts / quantities).
export function formatInt(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return intFmt.format(n)
}

// Quantities can be fractional in the source data; show up to 2 decimals, trimmed.
export function formatQty(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 100) / 100)
}

// A human-readable date (e.g. "15 Jul 2026"), or "" when unset.
export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function lineTotal(row) {
  return (Number(row.qty) || 0) * (Number(row.unit_price) || 0)
}
