import { loadEnv } from '../../../shared/config/index.js'
import { cleanText } from './text-cleaner.js'

const APIFY_BASE_URL = 'https://api.apify.com/v2'
const INSTAGRAM_ACTOR_ID = 'apify~instagram-scraper'
const POLL_TIMEOUT_MS = 180000
const POLL_INTERVAL_MS = 5000

type InstagramItem = {
  ownerUsername?: string
  ownerBiography?: string
  biography?: string
  ownerFullName?: string
  fullName?: string
  caption?: string
  text?: string
  url?: string
  inputUrl?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function extractInstagramUsername(instagramUrl: string): string {
  const cleaned = instagramUrl.trim().replace(/\/$/, '')
  const match = /instagram\.com\/([^/?#]+)/i.exec(cleaned)
  if (match === null) {
    throw new Error('Could not extract Instagram username from URL.')
  }

  const username = match[1].replace(/^@/, '')
  if (username === 'p' || username === 'reel' || username === 'reels' || username === 'stories' || username === 'explore') {
    throw new Error('Instagram URL must point to a profile.')
  }

  return username
}

function formatInstagramItems(username: string, items: InstagramItem[]): string {
  if (items.length === 0) {
    return cleanText(`Instagram profile: @${username}\nNo public posts found.`)
  }

  const sections: string[] = [`# Instagram: @${username}`]
  const first = items[0]
  const fullName = first.ownerFullName ?? first.fullName
  const biography = first.ownerBiography ?? first.biography

  if (fullName !== undefined && fullName.length > 0) {
    sections.push(`Name: ${fullName}`)
  }

  if (biography !== undefined && biography.length > 0) {
    sections.push(`Bio: ${biography}`)
  }

  sections.push('\n## Posts')

  for (const [index, item] of items.entries()) {
    let caption = item.caption ?? item.text ?? ''
    caption = cleanText(caption)
    if (caption.length === 0) {
      continue
    }

    const postUrl = item.url ?? item.inputUrl ?? `Post ${index + 1}`
    sections.push(`### ${postUrl}\n${caption}`)
  }

  return cleanText(sections.join('\n\n'))
}

async function waitForApifyRun(token: string, runId: string): Promise<void> {
  let elapsed = 0

  while (elapsed < POLL_TIMEOUT_MS) {
    const response = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      throw new Error(`Apify run status request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as { data?: { status?: string } }
    const status = payload.data?.status

    if (status === 'SUCCEEDED') {
      return
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify Instagram scrape failed with status: ${status}`)
    }

    await sleep(POLL_INTERVAL_MS)
    elapsed += POLL_INTERVAL_MS
  }

  throw new Error('Apify Instagram scrape timed out.')
}

export async function crawlInstagram(instagramUrl: string): Promise<string> {
  const { APIFY_API_TOKEN } = loadEnv()
  if (APIFY_API_TOKEN.trim().length === 0) {
    throw new Error('Apify API token is not configured.')
  }

  const username = extractInstagramUsername(instagramUrl)
  const runInput = {
    directUrls: [instagramUrl],
    resultsType: 'posts',
    resultsLimit: 20,
    searchType: 'user',
    searchLimit: 1,
  }

  const startResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${INSTAGRAM_ACTOR_ID}/runs?token=${encodeURIComponent(APIFY_API_TOKEN)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runInput),
      signal: AbortSignal.timeout(60000),
    },
  )

  if (!startResponse.ok) {
    throw new Error(`Apify run request failed with status ${startResponse.status}`)
  }

  const startPayload = (await startResponse.json()) as {
    data?: { id?: string; defaultDatasetId?: string }
  }

  const runId = startPayload.data?.id
  const datasetId = startPayload.data?.defaultDatasetId

  if (runId === undefined || datasetId === undefined) {
    throw new Error('Apify did not return a valid run.')
  }

  await waitForApifyRun(APIFY_API_TOKEN, runId)

  const itemsResponse = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${encodeURIComponent(APIFY_API_TOKEN)}&clean=true`,
    { signal: AbortSignal.timeout(60000) },
  )

  if (!itemsResponse.ok) {
    throw new Error(`Apify dataset request failed with status ${itemsResponse.status}`)
  }

  const items = (await itemsResponse.json()) as InstagramItem[]
  return formatInstagramItems(username, items)
}
