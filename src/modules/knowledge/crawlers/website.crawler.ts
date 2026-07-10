import { loadEnv } from '../../../shared/config/index.js'
import { logger } from '../../../shared/logger.js'
import {
  extractSameOriginLinks,
  extractSitemapUrls,
  stripHtmlToText,
  websiteSourceKey,
} from './html.utils.js'

export type WebsitePageContent = {
  sourceKey: string
  url: string
  text: string
}

function normalizeWebsiteUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim()
  if (trimmed.length === 0) {
    return null
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    if (!/^https?:$/i.test(url.protocol)) {
      return null
    }
    url.hash = ''
    return url
  } catch {
    return null
  }
}

async function fetchTextResponse(url: string, timeoutMs: number, maxBytes: number): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain,application/xml,text/xml',
        'User-Agent': 'ResponzaKnowledgeBot/1.0',
      },
    })

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('application/xml') &&
      !contentType.includes('text/xml')
    ) {
      return null
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > maxBytes) {
      return null
    }

    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function discoverWebsiteUrls(originUrl: URL, maxPages: number): Promise<string[]> {
  const discovered = new Set<string>([originUrl.toString()])
  const sitemapCandidates = ['/sitemap.xml', '/sitemap_index.xml']

  for (const path of sitemapCandidates) {
    const sitemapUrl = new URL(path, originUrl).toString()
    const xml = await fetchTextResponse(
      sitemapUrl,
      loadEnv().KNOWLEDGE_WEBSITE_FETCH_TIMEOUT_MS,
      loadEnv().KNOWLEDGE_WEBSITE_MAX_RESPONSE_BYTES,
    )

    if (xml === null) {
      continue
    }

    for (const url of extractSitemapUrls(xml, originUrl)) {
      discovered.add(url)
      if (discovered.size >= maxPages) {
        return [...discovered].slice(0, maxPages)
      }
    }
  }

  const homepageHtml = await fetchTextResponse(
    originUrl.toString(),
    loadEnv().KNOWLEDGE_WEBSITE_FETCH_TIMEOUT_MS,
    loadEnv().KNOWLEDGE_WEBSITE_MAX_RESPONSE_BYTES,
  )

  if (homepageHtml !== null) {
    for (const url of extractSameOriginLinks(homepageHtml, originUrl)) {
      discovered.add(url)
      if (discovered.size >= maxPages) {
        break
      }
    }
  }

  return [...discovered].slice(0, maxPages)
}

export async function crawlWebsite(websiteUrl: string): Promise<WebsitePageContent[]> {
  const originUrl = normalizeWebsiteUrl(websiteUrl)
  if (originUrl === null) {
    return []
  }

  const env = loadEnv()
  const urls = await discoverWebsiteUrls(originUrl, env.KNOWLEDGE_WEBSITE_MAX_PAGES)
  const pages: WebsitePageContent[] = []

  for (const url of urls) {
    const html = await fetchTextResponse(
      url,
      env.KNOWLEDGE_WEBSITE_FETCH_TIMEOUT_MS,
      env.KNOWLEDGE_WEBSITE_MAX_RESPONSE_BYTES,
    )

    if (html === null) {
      continue
    }

    const text = stripHtmlToText(html)
    if (text.length < 40) {
      continue
    }

    const pageUrl = new URL(url)
    pages.push({
      sourceKey: websiteSourceKey(pageUrl),
      url: pageUrl.toString(),
      text,
    })
  }

  logger.warn(
    `[knowledge] Website crawl completed origin=${originUrl.origin} pages=${pages.length} discovered=${urls.length}`,
  )

  return pages
}
