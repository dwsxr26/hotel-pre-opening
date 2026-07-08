// Month axis for the Services module: Jan-2025 → Sep-2027 (matches the model).
export const SERVICE_MONTHS = (() => {
  const out = []
  let y = 2025
  let m = 0 // January
  for (let i = 0; i < 33; i++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    out.push({ key, label })
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }
  return out
})()

// The past/future boundary is locked at Jun-2026: months up to and including
// this are "past" (historical figures); later months are the editable forecast.
export const PAST_CUTOFF = '2026-06-01'
export const isPastMonth = (key) => key <= PAST_CUTOFF

const DEFAULT_VAT = 22

// Gross an entry (or plain amount) for the incl-VAT view.
const gross = (amount, vatPct, incl) => (incl ? amount * (1 + (vatPct ?? DEFAULT_VAT) / 100) : amount)

// Compute a line's figures from its entries and closed months.
//   entries: [{ month, type: 'forecast'|'invoice', amount_ex_vat, vat_pct }]
//   closes:  Set of month keys that have been "closed"
// Returns { budget, spent, reforecast, remaining, monthly: { [monthKey]: {...} } }.
export function computeLine(line, entries = [], closes, incl = false) {
  const byMonth = {}
  for (const e of entries) {
    const b = (byMonth[e.month] ||= { forecast: 0, invoiced: 0 })
    const amt = gross(Number(e.amount_ex_vat) || 0, e.vat_pct, incl)
    if (e.type === 'invoice') b.invoiced += amt
    else b.forecast += amt
  }

  let reforecast = 0
  let spent = 0
  const monthly = {}
  for (const { key } of SERVICE_MONTHS) {
    const b = byMonth[key] || { forecast: 0, invoiced: 0 }
    const closed = !!closes?.has(key)
    // Invoices consume the forecast; a closed month expects only what was invoiced.
    const effective = closed ? b.invoiced : Math.max(b.forecast, b.invoiced)
    monthly[key] = { ...b, effective, closed }
    reforecast += effective
    spent += b.invoiced
  }

  const budget = incl ? (Number(line.budget) || 0) * (1 + DEFAULT_VAT / 100) : Number(line.budget) || 0
  return { budget, spent, reforecast, remaining: reforecast - spent, monthly }
}

// Aggregate several lines' figures (for the summary tables).
export function aggregate(lines, entriesByLine, closesByLine, incl) {
  const acc = { budget: 0, spent: 0, reforecast: 0, remaining: 0 }
  for (const line of lines) {
    const c = computeLine(line, entriesByLine[line.id], closesByLine[line.id], incl)
    acc.budget += c.budget
    acc.spent += c.spent
    acc.reforecast += c.reforecast
    acc.remaining += c.remaining
  }
  return acc
}
