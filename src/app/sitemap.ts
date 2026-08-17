import type { MetadataRoute } from 'next'

const BASE_URL = 'https://wavewarz.info'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes = [
    '',
    '/battles',
    '/leaderboards',
    '/leaderboards/songs',
    '/leaderboards/traders',
    '/leaderboards/artists',
    '/leaderboards/community',
    '/leaderboards/clippers',
    '/benefits',
    '/claim',
    '/contributor',
    '/privacy',
    '/terms',
  ]

  return staticRoutes.map(route => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '' || route === '/battles' ? 'hourly' : 'daily',
    priority: route === '' ? 1 : 0.7,
  }))
}
