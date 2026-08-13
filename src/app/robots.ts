import type { MetadataRoute } from 'next'

// Named user-agents for AI agents that fetch pages live on a user's behalf
// (e.g. Claude Desktop pulling a stat mid-conversation), plus the matching
// bulk crawlers. These get read access to the public API; generic crawlers
// (including Googlebot) do not — there's no SEO value in indexing raw JSON,
// and it's needless load on the API for no ranking benefit.
const AI_AGENT_USER_AGENTS = [
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/'],
      },
      ...AI_AGENT_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: ['/', '/api/public/'],
        disallow: ['/admin', '/api/admin', '/api/webhook'],
      })),
    ],
    sitemap: 'https://wavewarz.info/sitemap.xml',
  }
}
