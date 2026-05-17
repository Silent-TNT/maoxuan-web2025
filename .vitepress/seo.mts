import type { HeadConfig, PageData, TransformContext } from 'vitepress'

const SITE = 'https://xuemaoxuan.com'
const VOLUME_RE = /^(第一|第二|第三|第四)卷\/\d+-/

const NOINDEX_PATH_FRAGMENTS = ['api-examples', 'markdown-examples']

export function isArticlePage(relativePath: string) {
  return VOLUME_RE.test(relativePath.replace(/\\/g, '/'))
}

function articleSlug(relativePath: string) {
  const name = relativePath.replace(/\\/g, '/').split('/').pop() ?? ''
  const m = name.match(/^\d+-(.+)\.md$/)
  return m?.[1] ?? name.replace(/\.md$/, '')
}

/** 与 VitePress 默认构建路径一致（除首页外带 .html） */
function canonicalPath(pageData: PageData) {
  const rp = pageData.relativePath.replace(/\\/g, '/')
  if (rp === 'index.md') return '/'
  return `/${rp.replace(/\.md$/, '')}.html`
}

export function transformPageData(pageData: PageData) {
  const rp = pageData.relativePath.replace(/\\/g, '/')
  if (!isArticlePage(rp)) return

  const vol = rp.split('/')[0]!
  const slug = articleSlug(rp)
  const fm = pageData.frontmatter as Record<string, unknown>

  if (!fm.title) {
    const title = `${slug} - 毛泽东选集${vol}全文在线阅读`
    fm.title = title
    pageData.title = title
  }

  if (!fm.description) {
    const desc = `《${slug}》全文在线阅读。${vol}，无广告、手机适配、极简排版，附上一篇/下一篇导航。`
    fm.description = desc
    pageData.description = desc
  }
}

export function transformHead({ pageData }: TransformContext): HeadConfig[] {
  const extra: HeadConfig[] = []
  const path = canonicalPath(pageData)
  const canonical = `${SITE}${path}`

  extra.push(['link', { rel: 'canonical', href: canonical }])
  extra.push(['meta', { property: 'og:url', content: canonical }])
  extra.push(['meta', { property: 'og:type', content: isArticlePage(pageData.relativePath) ? 'article' : 'website' }])

  if (pageData.title) {
    extra.push(['meta', { property: 'og:title', content: String(pageData.title) }])
  }
  if (pageData.description) {
    extra.push(['meta', { property: 'og:description', content: String(pageData.description) }])
    extra.push(['meta', { name: 'description', content: String(pageData.description) }])
  }

  if (NOINDEX_PATH_FRAGMENTS.some((frag) => path.includes(frag))) {
    extra.push(['meta', { name: 'robots', content: 'noindex, nofollow' }])
  }

  if (isArticlePage(pageData.relativePath)) {
    const slug = articleSlug(pageData.relativePath.replace(/\\/g, '/'))
    const vol = pageData.relativePath.replace(/\\/g, '/').split('/')[0]!
    extra.push([
      'script',
      {
        type: 'application/ld+json',
      },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: slug,
        name: slug,
        isPartOf: {
          '@type': 'Book',
          name: `毛泽东选集${vol}`,
        },
        url: canonical,
        inLanguage: 'zh-CN',
        publisher: {
          '@type': 'Organization',
          name: '毛泽东选集在线阅读',
          url: SITE,
        },
      }),
    ])
  }

  return extra
}

export function transformSitemapItems<T extends { url: string; lastmod?: string; changefreq?: string; priority?: number }>(
  items: T[],
) {
  return items
    .filter(
      (item) =>
        !NOINDEX_PATH_FRAGMENTS.some((frag) => item.url.includes(frag)),
    )
    .map((item) => {
      if (item.url === '/') {
        return { ...item, changefreq: 'weekly', priority: 1 }
      }
      if (item.url === '/donate') {
        return { ...item, changefreq: 'monthly', priority: 0.5 }
      }
      if (/^\/(第一|第二|第三|第四)卷\/\d+-/.test(item.url)) {
        return { ...item, changefreq: 'monthly', priority: 0.8 }
      }
      return item
    })
}
