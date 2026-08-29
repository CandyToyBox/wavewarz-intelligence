export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { SponsorsManager, type SponsorProperty } from './sponsors-manager'

export default async function HubSponsors() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('sponsor_inventory').select('*').order('sort_order')
  const properties = (data ?? []).map(p => ({
    ...p,
    deliverables: (p.deliverables as string[]) ?? [],
  })) as SponsorProperty[]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Stop selling rectangles (Phase 23). The scalable unit is ownership of a recurring audience behavior or
        recognizable property — not a logo on a stream. Only offer a package once its format has run enough times to prove it repeats.
      </p>
      <SponsorsManager properties={properties} />
    </div>
  )
}
