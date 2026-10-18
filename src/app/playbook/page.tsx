export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import './playbook.css'
import { getPlaybookArtist } from '@/lib/playbook/session'
import { loadPlaybook } from '@/lib/playbook/data'
import { PlaybookApp } from './playbook-app'

export const metadata: Metadata = {
  title: 'Artists and Repertoire Playbook',
  robots: { index: false, follow: false },
}

export default async function PlaybookPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const artist = await getPlaybookArtist()

  if (!artist) {
    const { link } = await searchParams
    return (
      <div className="pb">
        <div className="gate">
          <p className="eyebrow">WaveWarZ founding artists</p>
          <h1>Open your private link</h1>
          <p className="lead">
            {link === 'invalid'
              ? 'That link is not working. It may have been replaced by a newer one. Ask Candy for a fresh link.'
              : link === 'unavailable'
                ? 'Sign-in is not available right now. Please try again in a little while.'
                : 'This playbook is private to each artist. Open the personal link Candy sent you and your answers will be here, saved as you go.'}
          </p>
          <p className="muted">If you do not have a link yet, ask Candy.</p>
        </div>
      </div>
    )
  }

  const snap = await loadPlaybook(artist.artistId)

  return (
    <PlaybookApp
      artistId={artist.artistId}
      displayName={artist.displayName}
      initial={{
        name: snap.name,
        answers: snap.answers,
        help: snap.help,
        submissions: snap.submissions,
        fileUrls: snap.fileUrls,
        hasSavedData: snap.updatedAt !== null,
      }}
    />
  )
}
