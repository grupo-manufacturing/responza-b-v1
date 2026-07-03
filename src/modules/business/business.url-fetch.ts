import { loadEnv } from '../../shared/config/index.js'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
])

const PRIVATE_IPV4_PATTERN =
  /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.)/

const RELEVANT_PATH_KEYWORDS = [
  'about',
  'about-us',
  'about_us',
  'who-we-are',
  'our-story',
  'company',
  'privacy',
  'privacy-policy',
  'privacy_policy',
  'terms',
  'terms-and-conditions',
  'terms-conditions',
  'terms-of-service',
  'terms-of-use',
  'terms-condition',
  'tos',
  'contact',
  'contact-us',
  'contact_us',
  'faq',
  'faqs',
  'help',
  'support',
  'services',
  'products',
] as const

const SKIPPED_PATH_KEYWORDS = [
  'login',
  'signin',
  'sign-in',
  'signup',
  'sign-up',
  'register',
  'cart',
  'checkout',
  'account',
  'admin',
  'wp-admin',
  'blog',
  'tag',
  'category',
  'author',
] as const

export type FetchedUrlExcerpt = {
  url: string
  title: string | null
  excerpt: string
  pageLabel: string
}

export type FetchedUrlHtml = {
  url: string
  html: string
  title: string | null
}

export function assertSafePublicHttpUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed')
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new Error('URLs with credentials are not allowed')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('URL host is not allowed')
  }

  if (PRIVATE_IPV4_PATTERN.test(hostname)) {
    throw new Error('Private network URLs are not allowed')
  }

  return parsed
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
}

function extractTagContent(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html)
  if (match === null) {
    return null
  }

  const content = match[1]?.trim()
  if (content === undefined || content.length === 0) {
    return null
  }

  return decodeHtmlEntities(content)
}

function extractTitle(html: string): string | null {
  return extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
}

function extractMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      'i',
    ),
  ]

  for (const pattern of patterns) {
    const value = extractTagContent(html, pattern)
    if (value !== null) {
      return value
    }
  }

  return null
}

function extractVisibleText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return decodeHtmlEntities(text)
}

function buildExcerpt(html: string, maxChars: number): string {
  const title = extractTitle(html)
  const description =
    extractMetaContent(html, 'og:description') ??
    extractMetaContent(html, 'description') ??
    extractMetaContent(html, 'twitter:description')

  const visibleText = extractVisibleText(html)

  const parts = [title, description, visibleText].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  )

  const combined = parts.join('\n\n').trim()
  if (combined.length <= maxChars) {
    return combined
  }

  return `${combined.slice(0, maxChars).trim()}…`
}

function normalizeSiteHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function isSameSiteUrl(base: URL, candidate: URL): boolean {
  return normalizeSiteHostname(base.hostname) === normalizeSiteHostname(candidate.hostname)
}

function shouldSkipDiscoveredPath(pathname: string): boolean {
  const path = pathname.toLowerCase()
  return SKIPPED_PATH_KEYWORDS.some((keyword) => path.includes(keyword))
}

function scoreDiscoveredLink(pathname: string, anchorText: string): number {
  const path = pathname.toLowerCase()
  const text = anchorText.toLowerCase().replace(/\s+/g, ' ').trim()
  let score = 0

  for (const keyword of RELEVANT_PATH_KEYWORDS) {
    const spaced = keyword.replace(/-/g, ' ')
    if (path.includes(keyword)) {
      score += 12
    }
    if (text.includes(keyword) || text.includes(spaced)) {
      score += 8
    }
  }

  return score
}

function pageLabelFromUrl(url: URL): string {
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    return 'home'
  }

  return segments[segments.length - 1] ?? 'page'
}

function extractAnchorLinks(html: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = []
  const pattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(pattern)) {
    const href = match[1]?.trim()
    if (href === undefined || href.length === 0) {
      continue
    }

    const text = match[2]
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    links.push({
      href,
      text: text ?? '',
    })
  }

  return links
}

export function discoverRelevantSameSiteLinks(
  siteUrl: string,
  html: string,
  maxLinks: number,
): string[] {
  let base: URL
  try {
    base = assertSafePublicHttpUrl(siteUrl)
  } catch {
    return []
  }

  const ranked = new Map<string, number>()

  for (const link of extractAnchorLinks(html)) {
    if (
      link.href.startsWith('mailto:') ||
      link.href.startsWith('tel:') ||
      link.href.startsWith('javascript:')
    ) {
      continue
    }

    let resolved: URL
    try {
      resolved = assertSafePublicHttpUrl(new URL(link.href, base).toString())
    } catch {
      continue
    }

    if (!isSameSiteUrl(base, resolved)) {
      continue
    }

    if (shouldSkipDiscoveredPath(resolved.pathname)) {
      continue
    }

    const score = scoreDiscoveredLink(resolved.pathname, link.text)
    if (score <= 0) {
      continue
    }

    const canonical = resolved.toString()
    const existing = ranked.get(canonical) ?? 0
    ranked.set(canonical, Math.max(existing, score))
  }

  return [...ranked.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxLinks)
    .map(([url]) => url)
}

export async function fetchPublicUrlHtml(rawUrl: string): Promise<FetchedUrlHtml | null> {
  const env = loadEnv()
  if (!env.BUSINESS_URL_FETCH_ENABLED) {
    return null
  }

  let parsed: URL
  try {
    parsed = assertSafePublicHttpUrl(rawUrl)
  } catch {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.BUSINESS_URL_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'User-Agent': 'ResponzaBusinessAgent/1.0 (+https://responza.app)',
      },
    })

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('application/xhtml')
    ) {
      return null
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength !== null && Number.parseInt(contentLength, 10) > env.BUSINESS_URL_FETCH_MAX_BYTES) {
      return null
    }

    const html = await response.text()
    if (html.length > env.BUSINESS_URL_FETCH_MAX_BYTES) {
      return null
    }

    return {
      url: parsed.toString(),
      html,
      title: extractTitle(html),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function htmlToExcerpt(page: FetchedUrlHtml, maxChars: number, pageLabel: string): FetchedUrlExcerpt | null {
  const excerpt = buildExcerpt(page.html, maxChars)
  if (excerpt.length === 0) {
    return null
  }

  return {
    url: page.url,
    title: page.title,
    excerpt,
    pageLabel,
  }
}

export async function fetchPublicUrlExcerpt(
  rawUrl: string,
  maxChars: number,
  pageLabel = 'page',
): Promise<FetchedUrlExcerpt | null> {
  const page = await fetchPublicUrlHtml(rawUrl)
  if (page === null) {
    return null
  }

  return htmlToExcerpt(page, maxChars, pageLabel)
}

export async function fetchWebsiteWithRelevantSubpages(
  rawUrl: string,
  maxCharsPerPage: number,
  maxSubpages: number,
): Promise<FetchedUrlExcerpt[]> {
  const home = await fetchPublicUrlHtml(rawUrl)
  if (home === null) {
    return []
  }

  const homeExcerpt = htmlToExcerpt(home, maxCharsPerPage, 'home')
  const excerpts: FetchedUrlExcerpt[] = homeExcerpt !== null ? [homeExcerpt] : []

  const subpageUrls = discoverRelevantSameSiteLinks(home.url, home.html, maxSubpages)
  if (subpageUrls.length === 0) {
    return excerpts
  }

  const subpageResults = await Promise.all(
    subpageUrls.map(async (url) => {
      const page = await fetchPublicUrlHtml(url)
      if (page === null) {
        return null
      }

      const label = pageLabelFromUrl(new URL(page.url))
      return htmlToExcerpt(page, maxCharsPerPage, label)
    }),
  )

  for (const excerpt of subpageResults) {
    if (excerpt !== null) {
      excerpts.push(excerpt)
    }
  }

  return excerpts
}
