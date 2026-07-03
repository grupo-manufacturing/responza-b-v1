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

export type FetchedUrlExcerpt = {
  url: string
  title: string | null
  excerpt: string
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

export async function fetchPublicUrlExcerpt(
  rawUrl: string,
  maxChars: number,
): Promise<FetchedUrlExcerpt | null> {
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

    const body = await response.text()
    if (body.length > env.BUSINESS_URL_FETCH_MAX_BYTES) {
      return null
    }

    const excerpt = buildExcerpt(body, maxChars)
    if (excerpt.length === 0) {
      return null
    }

    return {
      url: parsed.toString(),
      title: extractTitle(body),
      excerpt,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
