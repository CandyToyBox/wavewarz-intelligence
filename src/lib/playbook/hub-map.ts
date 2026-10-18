import type { ArtistBible } from '@/lib/booker-card'

// Where each playbook answer goes in the Hub once an admin accepts it.
// Nothing here writes anything by itself; src/lib/playbook/review.ts and the
// accept action in src/app/hub/playbook-actions.ts use it.

type BibleCol = Exclude<
  {
    [K in keyof ArtistBible]: ArtistBible[K] extends string | null ? K : never
  }[keyof ArtistBible],
  'artist_id' | 'updated_at'
>

export type Target =
  /** One text column of the Artist Archive (artist_bibles). */
  | { kind: 'bible'; col: BibleCol; dest: string }
  /** The three colors (artist_bibles.colors). */
  | { kind: 'palette'; dest: string }
  /** Sponsor fit: one per line becomes the list. */
  | { kind: 'sponsor_fit'; dest: string }
  /** No Archive field for it: kept in "Playbook extras" (artist_bibles.playbook_extras). */
  | { kind: 'extra'; label: string; dest: string }
  /** Files and links become rows in an Assets folder. */
  | { kind: 'assets'; category: string; pdfCategory?: string; note?: string; dest: string }
  /** Logo: an Assets > Logos row, and the Archive's Logo URL. */
  | { kind: 'logo'; dest: string }
  /** Entrance sting: Archive's sting URL and THE WALK cue URL (first link); more links go to THE WALK assets. */
  | { kind: 'sting'; dest: string }

const bible = (col: BibleCol, dest: string): Target => ({ kind: 'bible', col, dest })
const extra = (label: string, dest?: string): Target => ({ kind: 'extra', label, dest: dest ?? `Playbook extras > ${label}` })
const assets = (category: string, note?: string, pdfCategory?: string): Target => ({
  kind: 'assets', category, note, pdfCategory, dest: `Assets > ${category}${note ? ` (${note})` : ''}`,
})

export const HUB_MAP: Record<string, Target> = {
  // 1 Who you are
  who_one_line: bible('one_line_identity', 'Character > One-line identity'),
  who_genre: extra('Music and what makes it theirs'),
  who_short_bio: bible('short_bio', 'Character > Short bio'),
  who_want: bible('want', 'Character > What they want right now'),
  who_prove: bible('whats_proving', "Character > What they're trying to prove"),
  who_strength: bible('greatest_strength', 'Character > Greatest strength'),
  who_links: extra('Online links'),

  // 2 Your look
  look_logo: { kind: 'logo', dest: 'Assets > Logos, and Visual World > Logo URL' },
  look_photos: assets('Photos'),
  look_palette: { kind: 'palette', dest: 'Visual World > Signature / Secondary / Accent color' },
  look_symbol: bible('symbol', 'Visual World > Symbol / monogram'),
  look_character: bible('stage_character', 'Character > Full character: look, costume, stage presence'),
  look_ref: assets('Photos', 'reference'),
  look_effect: bible('visual_effect', 'Visual World > Signature graphic effect'),
  look_avoid: bible('do_not_use', 'Visual World > Do-not-use visual guidance'),

  // 3 Your story
  story_core1_clip: assets('Interviews', 'core answer 1'),
  story_core1: extra('Core answer 1 notes'),
  story_core2_clip: assets('Interviews', 'core answer 2'),
  story_core2: extra('Core answer 2 notes'),
  story_core3_clip: assets('Interviews', 'core answer 3'),
  story_core3: extra('Core answer 3 notes'),
  story_pick: extra('Story picks'),
  story_slice_plan: extra('Docu-slice plan'),
  story_meme: extra('Meme promo idea'),
  story_footage_links: assets('Video', 'older footage', 'Career Record'),
  story_footage: assets('Video', 'older footage', 'Career Record'),

  // 4 Music and videos
  music_goto: extra('Go-to song'),
  music_hits: extra('Hits'),
  music_videos: assets('Video', 'best video'),
  music_videos_files: assets('Video', 'best video'),
  music_live_links: assets('Video', 'live'),
  music_live: assets('Video', 'live'),
  music_rights: extra('Track ownership and rights'),

  // 5 Voice and lines
  voice_catch: bible('catchphrase', 'Sonic and Verbal > Primary catchphrase'),
  voice_win: bible('victory_phrase', 'Sonic and Verbal > Victory phrase'),
  voice_challenge: bible('challenge_phrase', 'Sonic and Verbal > Challenge phrase'),
  voice_signoff: bible('signoff', 'Sonic and Verbal > Sign-off'),
  voice_tone: bible('voice_tone', 'Sonic and Verbal > Voice / tone description'),
  voice_weapon: bible('signature_weapon', 'Sonic and Verbal > Signature weapon'),
  voice_limits: bible('trashtalk_boundaries', 'Sonic and Verbal > Trash-talk boundaries'),
  voice_fans: bible('community_name', 'Sonic and Verbal > Community / fan name'),

  // 6 Entrance
  walk_sound: { kind: 'sting', dest: 'Sonic and Verbal > Entrance sting URL, and THE WALK > Cue URL' },
  walk_intro: bible('announcer_intro', 'Sonic and Verbal > Announcer introduction'),
  walk_beats: bible('walk_script_md', 'THE WALK > Script / beats'),

  // 7 Home base
  home_website: extra('Website'),
  home_website_note: extra('Website notes'),
  home_youtube: extra('YouTube channel'),
  home_bio: extra('Platforms with matching bio'),
  home_images_note: extra('Profile and cover image notes'),
  home_images: assets('Photos', 'profile and cover'),
  home_thumbs_note: extra('Thumbnail notes'),
  home_thumbs: assets('Photos', 'thumbnails'),

  // 8 Community
  community_community: extra('Communities'),
  community_fit: { kind: 'sponsor_fit', dest: 'Sponsor Fit > Sponsor fit (one per line)' },
  community_family: extra('Family connections and introductions'),

  // 9 Archive
  archive_footage_note: extra('Archive notes'),
  archive_footage_links: assets('Career Record', 'archive footage'),
  archive_footage: assets('Career Record', 'archive footage'),
  archive_press: assets('Interviews', 'press and features'),
  archive_moments: extra('Top 3 career moments'),
  archive_credits: extra('Credits for third-party footage'),

  // 10 Merch
  merch_items: extra('Merch items wanted'),
  merch_other: extra('Other merch item'),
  merch_source: extra('Merch design direction'),
  merch_files: assets('Merch', 'design files'),
  merch_details: extra('Merch item, color, fit'),
  merch_words: extra('Merch words to print'),
  merch_ideal: extra('Ideal merch'),
  merch_inspo: assets('Merch', 'inspiration'),
}

/** Display labels for every "Playbook extras" entry, keyed by field id. */
export const EXTRA_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(HUB_MAP).flatMap(([k, t]) => (t.kind === 'extra' ? [[k, t.label]] : [])),
)

/** Which Hub module an Assets folder is shown under (the Hub's own module keys). */
export const CATEGORY_MODULE: Record<string, string> = {
  Logos: 'look', Photos: 'look', Interviews: 'story', Quotes: 'story', Video: 'music',
  'Career Record': 'archive', Merch: 'community', 'THE WALK': 'walk',
}
