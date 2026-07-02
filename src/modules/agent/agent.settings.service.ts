import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import * as businessRepository from '../business/business.repository.js'

const MIN_BUSINESS_DESCRIPTION_LENGTH = 20

export async function assertCanEnableBusinessAgent(organizationId: string): Promise<void> {
  const env = loadEnv()

  if (!env.AGENT_ENABLED) {
    throw new AppError(503, 'INTERNAL_ERROR', 'Business agent is not available right now.')
  }

  if (!env.AI_ENABLED || env.OPENAI_API_KEY.trim().length === 0) {
    throw new AppError(
      503,
      'INTERNAL_ERROR',
      'AI is required for the business agent but is not configured.',
    )
  }

  const profile = await businessRepository.findProfileByOrganizationId(organizationId)
  if (profile === null || profile.completed_at === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Complete business onboarding before enabling the agent.')
  }

  const description = profile.business_description?.trim() ?? ''
  if (description.length < MIN_BUSINESS_DESCRIPTION_LENGTH) {
    throw new AppError(
      400,
      'BAD_REQUEST',
      'Add a business description of at least 20 characters before enabling the agent.',
    )
  }
}
