import spec from './hub-modules.json'

// Modules break the Hub (and the Founding Artists A&R Playbook) into chunks that
// can be finished, saved and hidden one at a time. The same JSON drives both the
// Hub screens and the playbook handed to artists, so they cannot drift apart.

export type ModuleStatus = 'not_started' | 'in_progress' | 'done'
export type ModuleScope = 'artist' | 'event' | 'league'

export type ChecklistItem = { key: string; label: string }

export type HubModuleSpec = {
  key: string
  order: number
  title: string
  blurb: string
  why: string
  familyTie: string
  categories: string[]
  tier?: 'start' | 'next' | 'later'
  minutes?: number
  fields?: string[]
  sections?: string[]
  checklist?: ChecklistItem[]
  runway?: string[]
  skipOk?: string
}

export type ModuleState = { status: ModuleStatus; checklist: Record<string, boolean> }

export const FAMILY: string[] = spec.family
// One-line descriptions, only where we have a confirmed one.
export const FAMILY_NOTES: Record<string, string> = spec.familyNotes
export const ARTIST_MODULES = spec.artist as HubModuleSpec[]
export const EVENT_MODULES = spec.event as HubModuleSpec[]
export const LEAGUE_MODULES = spec.league as HubModuleSpec[]

export const MODULES: Record<ModuleScope, HubModuleSpec[]> = {
  artist: ARTIST_MODULES,
  event: EVENT_MODULES,
  league: LEAGUE_MODULES,
}

export function subjectKey(scope: ModuleScope, id?: string | null): string {
  if (scope === 'league') return 'league'
  return `${scope}:${id}`
}

// Rows from hub_modules for one subject -> state map keyed by module_key.
export function toStateMap(rows: { module_key: string; status: string; checklist: unknown }[] | null): Record<string, ModuleState> {
  const out: Record<string, ModuleState> = {}
  for (const r of rows ?? []) {
    out[r.module_key] = {
      status: (r.status as ModuleStatus) ?? 'not_started',
      checklist: (r.checklist as Record<string, boolean>) ?? {},
    }
  }
  return out
}

export function modulesDone(scope: ModuleScope, states: Record<string, ModuleState>): number {
  return MODULES[scope].filter(m => states[m.key]?.status === 'done').length
}

// Every asset category used by any module of a scope (so none are orphaned).
export function categoriesFor(scope: ModuleScope): string[] {
  const seen: string[] = []
  for (const m of MODULES[scope]) for (const c of m.categories) if (!seen.includes(c)) seen.push(c)
  return seen
}

// Columns the Hub pages select for content_assets (kept here, not in a client file).
export const ASSET_COLUMNS = 'id,category,franchise,title,url,asset_type,notes,why_added,family_tags,module_key'
