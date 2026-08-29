export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { StorylinesManager, type Storyline } from './storylines-manager'

export default async function HubStorylines() {
  const supabase = createAdminClient()
  const [storylinesRes, artistsRes] = await Promise.all([
    supabase.from('storylines').select('*').order('updated_at', { ascending: false }),
    supabase.from('artist_profiles').select('artist_id,display_name').order('display_name'),
  ])

  const storylines = (storylinesRes.data ?? []) as Storyline[]
  const artists = (artistsRes.data ?? []).map(a => ({ id: a.artist_id, name: a.display_name as string }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The relationship / story graph (Phases 17–18). Every ending creates another beginning — if a result
        doesn&apos;t update a storyline or set up what&apos;s next, the aftermath step isn&apos;t finished.
      </p>
      <StorylinesManager storylines={storylines} artists={artists} />
    </div>
  )
}
