export function stripHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

  const withBreaks = withoutScripts
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')

  const withoutTags = withBreaks.replace(/<[^>]+>/g, ' ')
  return withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function extractSameOriginLinks(html: string, baseUrl: URL): string[] {
  const hrefPattern = /href=["']([^"'#]+)["']/gi
  const links = new Set<string>()
  let match: RegExpExecArray | null = hrefPattern.exec(html)

  while (match !== null) {
    try {
      const resolved = new URL(match[1], baseUrl)
      if (resolved.origin === baseUrl.origin && /^https?:$/i.test(resolved.protocol)) {
        resolved.hash = ''
        links.add(resolved.toString())
      }
    } catch {
      // Ignore invalid URLs in markup.
    }
    match = hrefPattern.exec(html)
  }

  return [...links]
}

export function extractSitemapUrls(xml: string, baseUrl: URL): string[] {
  const locPattern = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  const urls: string[] = []
  let match: RegExpExecArray | null = locPattern.exec(xml)

  while (match !== null) {
    try {
      const resolved = new URL(match[1].trim())
      if (resolved.origin === baseUrl.origin && /^https?:$/i.test(resolved.protocol)) {
        urls.push(resolved.toString())
      }
    } catch {
      // Ignore invalid sitemap entries.
    }
    match = locPattern.exec(xml)
  }

  return urls
}

export function websiteSourceKey(pageUrl: URL): string {
  const path = pageUrl.pathname.replace(/\/+$/, '')
  return path.length === 0 ? '/' : path
}
