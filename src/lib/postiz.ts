/**
 * Postiz scheduling client — Intelligence app side.
 *
 * Called from the admin approveClip server action to schedule a clip to
 * Postiz directly from the dashboard (no Telegram bot required).
 *
 * Required env vars (optional — soft-fails if missing):
 *   POSTIZ_URL                  e.g. https://app.postiz.com
 *   POSTIZ_API_KEY              Postiz API key
 *   POSTIZ_INTEGRATION_YOUTUBE
 *   POSTIZ_INTEGRATION_TWITTER
 *   POSTIZ_INTEGRATION_INSTAGRAM
 *   POSTIZ_INTEGRATION_TIKTOK
 *   BOT_TOKEN                   Telegram bot token (to resolve file URLs)
 */

export type Platform = 'youtube' | 'twitter' | 'instagram' | 'tiktok'
export type PlatformCaptions = Record<Platform, string>

// ── Env ───────────────────────────────────────────────────────────────────────

function postizEnv() {
  return {
    url:     process.env.POSTIZ_URL ?? '',
    apiKey:  process.env.POSTIZ_API_KEY ?? '',
    integrations: {
      youtube:   process.env.POSTIZ_INTEGRATION_YOUTUBE   ?? '',
      twitter:   process.env.POSTIZ_INTEGRATION_TWITTER   ?? '',
      instagram: process.env.POSTIZ_INTEGRATION_INSTAGRAM ?? '',
      tiktok:    process.env.POSTIZ_INTEGRATION_TIKTOK    ?? '',
    },
    botToken: process.env.BOT_TOKEN ?? '',
  }
}

export function isPostizConfigured(): boolean {
  const e = postizEnv()
  return !!(e.url && e.apiKey)
}

// ── Telegram file → public URL ────────────────────────────────────────────────

async function resolveTelegramUrl(fileId: string, botToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    )
    if (!res.ok) return null
    const json = (await res.json()) as { result?: { file_path?: string } }
    const path = json.result?.file_path
    if (!path) return null
    return `https://api.telegram.org/file/bot${botToken}/${path}`
  } catch {
    return null
  }
}

// ── Upload media to Postiz CDN ────────────────────────────────────────────────

async function uploadMedia(mediaUrl: string, postizUrl: string, apiKey: string): Promise<string | null> {
  try {
    const fileRes = await fetch(mediaUrl)
    if (!fileRes.ok) return null
    const buffer = await fileRes.arrayBuffer()

    const ext  = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    const mime = ext === 'mp4' ? 'video/mp4' : 'image/jpeg'

    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mime }), `clip.${ext || 'mp4'}`)

    const res = await fetch(`${postizUrl}/public/v1/upload`, {
      method: 'POST',
      headers: { Authorization: apiKey },
      body: form,
    })
    if (!res.ok) return null
    const json = (await res.json()) as { path?: string }
    return json.path ?? null
  } catch {
    return null
  }
}

// ── Platform-specific settings ────────────────────────────────────────────────

function platformSettings(platform: Platform, caption: string): object {
  switch (platform) {
    case 'twitter':
      return { who_can_reply_post: 'everyone', community: '', active_thread_finisher: false }
    case 'instagram':
      return { post_type: 'reel', collaborators: [], is_trial_reel: false }
    case 'youtube':
      return {
        type: 'public',
        title: (caption.split('\n')[0] || 'WaveWarz Clip').slice(0, 100),
        selfDeclaredMadeForKids: 'no',
      }
    case 'tiktok':
      return {
        privacy_level: 'PUBLIC_TO_EVERYONE',
        content_posting_method: 'DIRECT_POST',
        autoAddMusic: 'no',
        comment: true, duet: false, stitch: false,
        video_made_with_ai: false, disclose: false,
        brand_organic_toggle: false, brand_content_toggle: false,
      }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function scheduleClipToPostiz(payload: {
  telegramFileId: string
  captions: PlatformCaptions
  platforms: Platform[]
  scheduledAt: Date
}): Promise<{ postizId?: string; error?: string }> {
  const e = postizEnv()

  if (!e.url || !e.apiKey) return { error: 'Postiz not configured' }
  if (!e.botToken) return { error: 'BOT_TOKEN not set — cannot resolve Telegram file URL' }

  // 1. Resolve Telegram file URL
  const mediaUrl = await resolveTelegramUrl(payload.telegramFileId, e.botToken)
  if (!mediaUrl) return { error: 'Could not resolve Telegram file URL' }

  // 2. Upload media once (shared across all platforms)
  const uploadedPath = await uploadMedia(mediaUrl, e.url, e.apiKey)
  const imageObjects = uploadedPath
    ? [{ id: crypto.randomUUID(), path: uploadedPath, alt: null, thumbnail: null, thumbnailTimestamp: null }]
    : []

  // 3. Build per-platform posts
  const group = Math.random().toString(36).slice(2, 12)

  const posts = payload.platforms
    .map(platform => {
      const integrationId = e.integrations[platform]
      if (!integrationId) return null
      if (platform === 'youtube' && imageObjects.length === 0) return null
      return {
        integration: { id: integrationId },
        group,
        value: [{
          id: Math.random().toString(36).slice(2, 12),
          content: payload.captions[platform],
          delay: 0,
          image: imageObjects,
        }],
        settings: platformSettings(platform, payload.captions[platform]),
      }
    })
    .filter(Boolean)

  if (posts.length === 0) return { error: 'No configured Postiz integrations for selected platforms' }

  // 4. Create scheduled post
  try {
    const res = await fetch(`${e.url}/public/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: e.apiKey },
      body: JSON.stringify({
        type: 'schedule',
        date: payload.scheduledAt.toISOString(),
        shortLink: true,
        tags: [],
        posts,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[postiz] HTTP', res.status, body.slice(0, 300))
      return { error: `Postiz error ${res.status}` }
    }

    const json = (await res.json()) as { id: string }
    return { postizId: json.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Postiz request failed' }
  }
}
