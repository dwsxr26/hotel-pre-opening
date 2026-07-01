// Seed the Florence Pre-Opening database from supabase/seed/items.json.
//
//   1. Create the Supabase project and run supabase/migrations/0001_init.sql.
//   2. Put SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env.local.
//   3. npm run seed
//
// Uses the service_role key so it bypasses RLS. This runs on YOUR machine only;
// the key is never bundled into the browser app.
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

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const here = dirname(fileURLToPath(import.meta.url))
const items = JSON.parse(readFileSync(join(here, '..', 'supabase', 'seed', 'items.json'), 'utf8'))

async function main() {
  // 1. Categories — unique, non-empty, sorted.
  const categoryNames = [...new Set(items.map((i) => i.category).filter(Boolean))].sort()
  const { error: catErr } = await supabase
    .from('categories')
    .upsert(categoryNames.map((name) => ({ name })), { onConflict: 'name' })
  if (catErr) throw catErr
  console.log(`Upserted ${categoryNames.length} categories.`)

  // 2. Items — replace any existing rows so re-seeding is idempotent.
  const { error: delErr } = await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) throw delErr

  // Insert in chunks to stay well under request limits.
  const chunkSize = 200
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const { error } = await supabase.from('items').insert(chunk)
    if (error) throw error
    console.log(`Inserted items ${i + 1}–${i + chunk.length} of ${items.length}.`)
  }

  console.log('\nDone. Seeded', items.length, 'items and', categoryNames.length, 'categories.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
