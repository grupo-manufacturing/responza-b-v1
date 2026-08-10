import { loadEnv } from '../../../shared/config/index.js'
import { cleanText } from './text-cleaner.js'

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2'
const CRAWL_PAGE_LIMIT = 20
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 180000

type CrawlPage = {
  metadata?: {
    sourceURL?: string
    url?: string
  }
  markdown?: string
  content?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function combineCrawlPages(pages: CrawlPage[]): string {
  const sections: string[] = []

  for (const page of pages) {
    const metadata = page.metadata ?? {}
    const pageUrl = metadata.sourceURL ?? metadata.url ?? 'Unknown page'
    let markdown = page.markdown ?? page.content ?? ''
    markdown = cleanText(markdown)
    if (markdown.length > 0) {
      sections.push(`## ${pageUrl}\n\n${markdown}`)
    }
  }

  return cleanText(sections.join('\n\n'))
}

async function pollCrawlJob(crawlId: string, apiKey: string): Promise<CrawlPage[]> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  let elapsed = 0

  while (elapsed < POLL_TIMEOUT_MS) {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/crawl/${crawlId}`, { headers })
    if (!response.ok) {
      throw new Error(`Firecrawl status request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as {
      status?: string
      data?: CrawlPage[]
      error?: string
    }

    if (payload.status === 'completed') {
      return payload.data ?? []
    }

    if (payload.status === 'failed') {
      throw new Error(payload.error ?? 'Firecrawl crawl failed.')
    }

    await sleep(POLL_INTERVAL_MS)
    elapsed += POLL_INTERVAL_MS
  }

  throw new Error('Firecrawl crawl timed out.')
}

export async function crawlWebsite(url: string): Promise<string> {
  const { FIRECRAWL_API_KEY } = loadEnv()
  if (FIRECRAWL_API_KEY.trim().length === 0) {
    throw new Error('Firecrawl API key is not configured.')
  }

  const headers = {
    Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    'Content-Type': 'application/json',
  }

  const payload = {
    url,
    limit: CRAWL_PAGE_LIMIT,
    scrapeOptions: { formats: ['markdown'] },
  }

  const response = await fetch(`${FIRECRAWL_BASE_URL}/crawl`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    throw new Error(`Firecrawl crawl request failed with status ${response.status}`)
  }

  const job = (await response.json()) as {
    success?: boolean
    id?: string
    status?: string
    data?: CrawlPage[]
    error?: string
  }

  if (job.success === false && job.id === undefined) {
    throw new Error(job.error ?? 'Firecrawl crawl failed to start.')
  }

  if (job.status === 'completed' && job.data !== undefined) {
    return combineCrawlPages(job.data)
  }

  const crawlId = job.id
  if (crawlId === undefined) {
    throw new Error('Firecrawl did not return a crawl job ID.')
  }

  const pages = await pollCrawlJob(crawlId, FIRECRAWL_API_KEY)
  return combineCrawlPages(pages)
}
