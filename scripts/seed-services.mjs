// Seed the Services module from supabase/seed/services.json.
// Safe to re-run — it only replaces service_lines/service_entries, never items.
//
//   1. Run supabase/migrations/0007_services.sql in the SQL editor.
//   2. npm run seed:services
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const here = dirname(fileURLToPath(import.meta.url))
const lines = JSON.parse(readFileSync(join(here, '..', 'supabase', 'seed', 'services.json'), 'utf8'))

async function main() {
  // Clear existing service data (entries cascade from lines).
  const { error: delErr } = await supabase
    .from('service_lines')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) throw delErr

  let entryCount = 0
  for (const line of lines) {
    const { data: created, error } = await supabase
      .from('service_lines')
      .insert({
        name: line.name,
        department: line.department,
        owner: line.owner || '',
        budget: line.budget || 0,
        sort_index: line.sort_index || 0,
      })
      .select('id')
      .single()
    if (error) throw error

    const entries = (line.forecasts || []).map((f) => ({
      line_id: created.id,
      month: f.month,
      type: 'forecast',
      amount_ex_vat: f.amount_ex_vat,
      vat_pct: 22,
    }))
    if (entries.length) {
      const { error: eErr } = await supabase.from('service_entries').insert(entries)
      if (eErr) throw eErr
      entryCount += entries.length
    }
  }
  console.log(`Seeded ${lines.length} service lines and ${entryCount} forecast entries.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
