import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — WaveWarZ Intelligence',
  description: 'Battle recaps and news from WaveWarZ, published on Paragraph.',
}

// Posts live on Paragraph (paragraph.com/@wavewarz). This page lists them and links out.
const PUBLICATION_ID = '03UA0mTK3s5mVAF7BWI5'
const PUBLICATION_URL = 'https://paragraph.com/@wavewarz'

type Post = {
  id: string
  title: string
  subtitle?: string
  slug: string
  imageUrl?: string
  publishedAt: string // epoch ms as a string
}

async function getPosts(): Promise<Post[] | null> {
  try {
    const res = await fetch(
      `https://public.api.paragraph.com/api/v1/publications/${PUBLICATION_ID}/posts?limit=50`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { items?: Post[] }
    return (json.items ?? []).sort((a, b) => Number(b.publishedAt) - Number(a.publishedAt))
  } catch {
    return null
  }
}

function formatDate(ms: string) {
  return new Date(Number(ms)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-rajdhani font-bold text-white tracking-tight">
            WaveWarZ <span className="text-[#7ec1fb]">Blog</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Battle recaps and news from the arena.
          </p>
        </div>
        <a
          href={PUBLICATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#7ec1fb] hover:underline"
        >
          Subscribe on Paragraph ↗
        </a>
      </div>

      {posts === null ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          We couldn&apos;t load the posts right now.{' '}
          <a href={PUBLICATION_URL} target="_blank" rel="noopener noreferrer" className="text-[#7ec1fb] hover:underline">
            Read the blog on Paragraph ↗
          </a>
        </div>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => (
            <a
              key={post.id}
              href={`${PUBLICATION_URL}/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col hover:border-[#7ec1fb]/50 transition-colors"
            >
              {post.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imageUrl} alt="" className="w-full aspect-video object-cover" loading="lazy" />
              )}
              <div className="p-5 flex flex-col gap-2 flex-1">
                <span className="text-[10px] font-mono text-muted-foreground">{formatDate(post.publishedAt)}</span>
                <h2 className="text-lg font-rajdhani font-bold text-white leading-tight group-hover:text-[#7ec1fb] transition-colors">
                  {post.title}
                </h2>
                {post.subtitle && (
                  <p className="text-sm text-gray-400 leading-relaxed">{post.subtitle}</p>
                )}
                <span className="mt-auto pt-2 text-xs text-[#7ec1fb]">Read on Paragraph ↗</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
