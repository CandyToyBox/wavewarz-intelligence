import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
for (const l of env.split('\n')) { const eq = l.indexOf('='); if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim() }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { error } = await sb
    .from('artist_profiles')
    .update({ display_name: 'TheTech' })
    .eq('artist_id', 'd3837d31-be31-4caf-9cfe-ab2a9eedd2e2')
  console.log(error ? 'Error: ' + error.message : 'Updated: Chill Sample Hub → TheTech')
}

main().catch(console.error)
