const INSTAGRAM_MESSAGING_WINDOW_MESSAGE =
  'Instagram only allows replies within 24 hours of the customer\'s last message. Ask the customer to message you again to reopen the chat.'

type GraphErrorBody = {
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    type?: string
    is_transient?: boolean
  }
  error_message?: string
}

const MESSAGING_WINDOW_SUBCODES = new Set([2534022, 2018031, 1545041])

function isMessagingWindowMessage(message: string): boolean {
  return (
    /time window/i.test(message) ||
    /allowed window/i.test(message) ||
    /时间窗/.test(message) ||
    /messaging window/i.test(message)
  )
}

function normalizeGraphApiErrorMessage(
  message: string,
  body?: GraphErrorBody,
): string {
  const code = body?.error?.code
  const subcode = body?.error?.error_subcode

  if (
    code === 10 ||
    (subcode !== undefined && MESSAGING_WINDOW_SUBCODES.has(subcode)) ||
    isMessagingWindowMessage(message)
  ) {
    return INSTAGRAM_MESSAGING_WINDOW_MESSAGE
  }

  return message
}

export async function parseGraphApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as GraphErrorBody
    const nestedMessage = body.error?.message
    if (typeof nestedMessage === 'string' && nestedMessage.length > 0) {
      return normalizeGraphApiErrorMessage(nestedMessage, body)
    }
    const flatMessage = body.error_message
    if (typeof flatMessage === 'string' && flatMessage.length > 0) {
      return normalizeGraphApiErrorMessage(flatMessage, body)
    }
  } catch {
    return `${fallback} (${response.status})`
  }
  return `${fallback} (${response.status})`
}

export type { GraphErrorBody }
