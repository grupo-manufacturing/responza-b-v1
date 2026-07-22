function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function foldHeaderLine(name: string, value: string): string {
  return `${name}: ${value}`
}

export type BuildRawGmailMessageInput = {
  from: string
  to: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
}

export function buildRawGmailMessage(input: BuildRawGmailMessageInput): string {
  const lines = [
    foldHeaderLine('From', input.from),
    foldHeaderLine('To', input.to),
    foldHeaderLine('Subject', input.subject),
  ]

  if (input.inReplyTo !== undefined && input.inReplyTo.trim().length > 0) {
    lines.push(foldHeaderLine('In-Reply-To', input.inReplyTo.trim()))
  }

  if (input.references !== undefined && input.references.trim().length > 0) {
    lines.push(foldHeaderLine('References', input.references.trim()))
  }

  lines.push('MIME-Version: 1.0')
  lines.push('Content-Type: text/plain; charset=UTF-8')
  lines.push('Content-Transfer-Encoding: 7bit')
  lines.push('')
  lines.push(input.body)

  return encodeBase64Url(lines.join('\r\n'))
}

export function extractEmailAddress(value: string): string {
  const trimmed = value.trim()
  const angleMatch = trimmed.match(/<([^>]+)>/)
  if (angleMatch !== null && angleMatch[1] !== undefined) {
    return angleMatch[1].trim()
  }

  return trimmed
}

export function buildReplySubject(subject: string): string {
  const trimmed = subject.trim()
  if (trimmed.length === 0) {
    return 'Re:'
  }

  if (/^re:/i.test(trimmed)) {
    return trimmed
  }

  return `Re: ${trimmed}`
}

export function buildReplyReferences(
  references: string | undefined,
  messageIdHeader: string | undefined,
): string | undefined {
  const messageId = messageIdHeader?.trim() ?? ''
  const existingReferences = references?.trim() ?? ''

  if (messageId.length === 0) {
    return existingReferences.length > 0 ? existingReferences : undefined
  }

  if (existingReferences.length === 0) {
    return messageId
  }

  return `${existingReferences} ${messageId}`
}
