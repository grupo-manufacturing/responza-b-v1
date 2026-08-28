import { Resend } from 'resend'

import { logger } from '../../shared/logger.js'
import { getFrontendPublicUrl, getResendApiKey, getResendFromEmail, isResendConfigured } from './email.config.js'
import { buildWelcomeEmail } from './templates/welcome-email.js'

let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (resendClient === null) {
    resendClient = new Resend(getResendApiKey())
  }

  return resendClient
}

async function sendWelcomeEmail(input: { email: string; name: string }): Promise<void> {
  const recipientName = input.name.trim().length > 0 ? input.name.trim() : 'there'
  const { subject, html, text } = buildWelcomeEmail({
    recipientName,
    appUrl: getFrontendPublicUrl(),
  })

  const { error } = await getResendClient().emails.send({
    from: getResendFromEmail(),
    to: input.email,
    subject,
    html,
    text,
  })

  if (error !== null) {
    throw new Error(error.message)
  }
}

export function queueWelcomeEmail(input: {
  organizationId: string
  email: string
  name: string
}): void {
  if (!isResendConfigured()) {
    logger.info('Welcome email skipped: Resend is not configured')
    return
  }

  void (async () => {
    try {
      await sendWelcomeEmail({ email: input.email, name: input.name })
    } catch (error) {
      logger.warn('Welcome email failed', {
        organizationId: input.organizationId,
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })()
}
