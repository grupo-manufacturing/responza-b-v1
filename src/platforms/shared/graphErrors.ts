type GraphErrorBody = {
  error?: {
    message?: string
    code?: number
    type?: string
    is_transient?: boolean
  }
  error_message?: string
}

export async function parseGraphApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as GraphErrorBody
    const nestedMessage = body.error?.message
    if (typeof nestedMessage === 'string' && nestedMessage.length > 0) {
      return nestedMessage
    }
    const flatMessage = body.error_message
    if (typeof flatMessage === 'string' && flatMessage.length > 0) {
      return flatMessage
    }
  } catch {
    return `${fallback} (${response.status})`
  }
  return `${fallback} (${response.status})`
}

export type { GraphErrorBody }
