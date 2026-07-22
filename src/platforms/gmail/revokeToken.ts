import { logger } from '../../shared/logger.js'

export async function revokeGmailToken(token: string): Promise<void> {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    return
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: trimmed }).toString(),
    })

    if (!response.ok) {
      logger.warn('[gmail] token revoke failed', {
        status: response.status,
      })
    }
  } catch (error: unknown) {
    logger.warn('[gmail] token revoke error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
