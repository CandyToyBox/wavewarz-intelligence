/** Image URL for an artist's WavID (see src/pages/api/wavid-art/[handle].ts). */
export function wavIdArtUrl(handle: string, opts: { format?: 'svg' | 'png'; size?: number } = {}) {
  const { format = 'png', size = 160 } = opts
  const q = format === 'svg' ? 'format=svg' : `format=png&size=${size}`
  return `/api/wavid-art/${encodeURIComponent(handle)}?${q}`
}

export function wavIdCardUrl(handle: string) {
  return `/wavid/card/${encodeURIComponent(handle)}`
}
