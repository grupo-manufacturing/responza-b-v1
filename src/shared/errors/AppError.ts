export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SUBSCRIPTION_REQUIRED'
  | 'INTEGRATIONS_REQUIRED'
  | 'NOT_IMPLEMENTED'
  | 'BILLING_NOT_CONFIGURED'
  | 'CONVERSATION_LIMIT_REACHED'
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'INGESTED_CONTENT_NOT_FOUND'
  | 'INDEXING_NO_INGESTED_CONTENT'
  | 'KNOWLEDGE_BASE_NOT_FOUND'
  | 'JOB_IN_PROGRESS'
  | 'JOB_NOT_FOUND'
  | 'JOB_NOT_RETRYABLE'
  | 'SERVICE_UNAVAILABLE'

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
