export type GmailMessagePart = {
  mimeType?: string
  body?: {
    data?: string
    size?: number
  }
  parts?: GmailMessagePart[]
}

export type GmailApiMessage = {
  id?: string
  threadId?: string
  snippet?: string
  internalDate?: string
  payload?: {
    headers?: Array<{ name?: string; value?: string }>
    mimeType?: string
    body?: {
      data?: string
    }
    parts?: GmailMessagePart[]
  }
}

export type ParsedGmailMessage = {
  id: string
  threadId?: string
  from: string
  to: string
  subject: string
  snippet: string
  bodyHtml: string | null
  receivedAt: string
  messageIdHeader?: string
  references?: string
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + padding, 'base64').toString('utf8')
}

function getHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string {
  if (headers === undefined) {
    return ''
  }

  const match = headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
  return match?.value?.trim() ?? ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractBodyContent(part: GmailMessagePart | undefined): { html: string | null; text: string | null } {
  if (part === undefined) {
    return { html: null, text: null }
  }

  let html: string | null = null
  let text: string | null = null

  const mimeType = part.mimeType?.toLowerCase() ?? ''
  const data = part.body?.data

  if (typeof data === 'string' && data.length > 0) {
    const decoded = decodeBase64Url(data)
    if (mimeType === 'text/html') {
      html = decoded
    } else if (mimeType === 'text/plain') {
      text = decoded
    }
  }

  for (const child of part.parts ?? []) {
    const childContent = extractBodyContent(child)
    if (html === null && childContent.html !== null) {
      html = childContent.html
    }
    if (text === null && childContent.text !== null) {
      text = childContent.text
    }
  }

  return { html, text }
}

function resolveBodyHtml(payload: GmailApiMessage['payload']): string | null {
  if (payload === undefined) {
    return null
  }

  const fromParts = extractBodyContent(payload as GmailMessagePart)
  if (fromParts.html !== null) {
    return fromParts.html
  }

  if (fromParts.text !== null) {
    return `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(fromParts.text)}</pre>`
  }

  const mimeType = payload.mimeType?.toLowerCase() ?? ''
  const data = payload.body?.data
  if (typeof data === 'string' && data.length > 0) {
    const decoded = decodeBase64Url(data)
    if (mimeType === 'text/html') {
      return decoded
    }
    if (mimeType === 'text/plain') {
      return `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(decoded)}</pre>`
    }
  }

  return null
}

function parseReceivedAt(internalDate: string | undefined): string {
  if (internalDate === undefined || internalDate.trim().length === 0) {
    return new Date().toISOString()
  }

  const parsed = Number(internalDate)
  if (!Number.isFinite(parsed)) {
    return new Date().toISOString()
  }

  return new Date(parsed).toISOString()
}

export function parseGmailMessage(message: GmailApiMessage, options?: { includeBody?: boolean }): ParsedGmailMessage {
  const id = message.id?.trim() ?? ''
  if (id.length === 0) {
    throw new Error('Gmail message is missing id')
  }

  const headers = message.payload?.headers
  const includeBody = options?.includeBody ?? false
  const messageIdHeader = getHeader(headers, 'Message-ID')
  const references = getHeader(headers, 'References')
  const threadId = message.threadId?.trim() ?? ''

  return {
    id,
    ...(threadId.length > 0 ? { threadId } : {}),
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject') || '(No subject)',
    snippet: message.snippet?.trim() ?? '',
    bodyHtml: includeBody ? resolveBodyHtml(message.payload) : null,
    receivedAt: parseReceivedAt(message.internalDate),
    ...(messageIdHeader.length > 0 ? { messageIdHeader } : {}),
    ...(references.length > 0 ? { references } : {}),
  }
}
