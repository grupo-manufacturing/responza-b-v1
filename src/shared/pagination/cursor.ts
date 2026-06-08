import { AppError } from '../errors/index.js'

export type CursorPayload = {
  readonly createdAt: string
  readonly id: string
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload
    if (
      typeof parsed.createdAt !== 'string' ||
      parsed.createdAt.length === 0 ||
      typeof parsed.id !== 'string' ||
      parsed.id.length === 0
    ) {
      throw new Error('Invalid cursor shape')
    }

    return parsed
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid pagination cursor')
  }
}
