# WaveWarZ Intelligence — site changelog

Changes to wavewarz.info that visitors or the team can see: pages, routes, embedded
tools, the calendar. Newest first.

Changes to what the public API returns are logged separately in
[`docs/API-CHANGELOG.md`](docs/API-CHANGELOG.md) (rendered at
wavewarz.info/api-docs/changelog), so a number moving under an API user is never
buried here.

**Entry shape:** date · area · what changed · PR.

---

## 2026-11-11

**Voter Guide: now for the November 15 battle.** The guide was still written for the
October 18 battle. Date, time (7:00 PM EST), matchup (S.R. Chappell vs Retrospect)
and the "Follow the battle on X" link are updated, and the event is called "WaveWarZ
Music Battle" instead of "Community Music Battle". The date is written into the
guide's text, so it needs updating again after each battle.

## 2026-11-03

**WAVE ID: cards for every roster artist.** Studio updated to upstream 08f67aa. A card
at `/wavid/card/<handle>` now looks the artist up in the live WaveWarZ roster, so any
birth-eligible artist gets their art and wave-code, not just the four fixture artists
(for example `oxquan` maps to `_0xQuan`). Identity kits also include the card face.

**Blog.** New `/blog` page lists the WaveWarZ Paragraph posts (paragraph.com/@wavewarz),
newest first; each card opens the post on Paragraph. New posts appear on their own
within about 10 minutes. "Blog" added to the top nav and the sitemap. (#22)

**Homepage: featured event and Platform Stats moved to the top.** Both sections now sit
directly under the title row, ahead of "What Is WaveWarZ", Meet DJ Wavy and
"What You'll Find Here". (#21)

**Calendar: standing weekly shows.** The calendar now lists the recurring shows on every
matching day for the next 26 weeks, and an "Every Week" card shows the schedule
at a glance. Times are Eastern (ET). No end time is shown because the shows run for
hours.
- WaveWarZ X Space: Mon-Fri, 11:00 AM ET
- Quick Battlez (X Space + livestream): Mon, Wed, Fri, 9:00 PM ET
- MythicGodz & DJ Candy (music and discussion, X Space): Tue, Thu, 9:00 PM ET

The shows live in `src/lib/weekly-schedule.ts`, because `calendar_events` stores one
row per date. They do not crowd "Up Next", which still lists one-off events (Main
Events, community battles) from the admin calendar. Link on each is x.com/wavewarz.

**Admin: flyer uploads up to 4 MB.** Uploading a calendar flyer over 1 MB failed with
"Body exceeded 1 MB limit". The limit is now 4 MB (Vercel's own cap is 4.5 MB).
**Legal: User Data Deletion page.** New `/data-deletion` page (what can be deleted, how
to ask, the 30-day window, how to remove the app in Facebook and Instagram, what
cannot be erased onchain). Privacy and Terms now cover Facebook, Instagram and
Threads; Privacy is dated October 2026; the page is in the sitemap. (#17)

**WAVE ID: embed fits its content.** `/wavid` no longer cuts the studio off at a fixed
height. The frame sizes itself to the studio's content (minimum 720px) and follows
tab changes and window resizes. (#19)

**WAVE ID: studio updated to upstream f58f875.** The embedded WavID Browser Studio
is rebuilt from Quan's latest. New: wave-code woven into card artwork, card scanning,
and the live battle panel. (#18)

**WAVE ID: card and scan links.** `/wavid/card/<audiusHandle>` and `/wavid/scan` now open
the matching studio screens (temporary 307 redirects), so the URL printed on a
card works. Card artwork exists only for the four fixture artists for now; other
handles show the Audius profile link. `/events` redirects to `/benefits`. (#18)
