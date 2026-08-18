export function encodeCursor<T extends Record<string, string>>(cursor: T): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeCursor<T extends Record<string, string>>(
  encoded: string,
  keys: readonly (keyof T & string)[],
): T | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown

    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }

    for (const key of keys) {
      if (typeof Reflect.get(parsed, key) !== 'string') {
        return null
      }
    }

    return parsed as T
  } catch {
    return null
  }
}

export function escapeCursorValue(value: string): string {
  return value.replaceAll('"', '\\"')
}
