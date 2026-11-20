import type { NextApiRequest, NextApiResponse } from 'next'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import sharp from 'sharp'
import { WavIdRenderer, type WavIdRendererProps } from '@/lib/wavid/renderer/WavIdRenderer'
import { getWavIdRoster, wavIdDefinition } from '@/lib/wavid/roster'

// Serves one artist's WavID as an image so pages can use a plain <img>.
// A single WavID is ~1 MB of SVG markup (dense strand geometry), far too heavy
// to inline once per row in a list, so:
//   ?format=svg           exact browser-rendered artwork (hero use)
//   ?format=png&size=N    small raster for lists and marks (default 160px)
// Both are the roster checkpoint at frame 88, the frame Quan's card and live
// battle panel use. Cached at the edge; the roster feed refreshes every 5 min.
//
// This lives in the Pages router on purpose: the App Router refuses any import
// of react-dom/server, and rendering the renderer to a string needs it.

const FRAME = 88

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const handle = String(req.query.handle ?? '')
  const format = req.query.format === 'png' ? 'png' : 'svg'
  const size = Math.min(Math.max(Number(req.query.size) || 160, 32), 1080)

  const roster = await getWavIdRoster()
  const artist = roster?.byHandle.get(handle.toLowerCase())
  if (!roster || !artist) {
    res.status(404).send('No WavID for this handle')
    return
  }

  const { props } = wavIdDefinition(artist, roster)
  const svg = renderToStaticMarkup(
    createElement(WavIdRenderer, {
      // generateDefinition lives in untyped .mjs; its props are the renderer's props.
      props: props as WavIdRendererProps['props'],
      frame: FRAME,
      title: `${artist.displayName} WavID`,
    }),
  )
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  if (format === 'svg') {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    res.status(200).send(svg)
    return
  }
  const png = await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
  res.setHeader('Content-Type', 'image/png')
  res.status(200).send(png)
}
