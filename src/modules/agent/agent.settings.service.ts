import type { AuthContext } from '../../shared/auth/index.js'
import type { UpdateAgentSettingsBody } from './agent.schemas.js'
import * as agentRepository from './agent.repository.js'

function toAgentSettingsResponse(settings: agentRepository.AgentSettingsRecord) {
  return {
    organizationId: settings.organization_id,
    enabled: settings.enabled,
    confidenceThreshold: Number(settings.confidence_threshold),
    businessHoursEnabled: settings.business_hours_enabled,
    businessHoursTimezone: settings.business_hours_timezone,
    businessHoursStart: settings.business_hours_start,
    businessHoursEnd: settings.business_hours_end,
    createdAt: settings.created_at,
    updatedAt: settings.updated_at,
  }
}

export async function getAgentSettings(auth: AuthContext) {
  const settings = await agentRepository.getAgentSettings(auth.organizationId)
  return toAgentSettingsResponse(settings)
}

export async function updateAgentSettings(auth: AuthContext, input: UpdateAgentSettingsBody) {
  const settings = await agentRepository.updateAgentSettings(auth.organizationId, {
    enabled: input.enabled,
    confidence_threshold: input.confidenceThreshold,
    business_hours_enabled: input.businessHoursEnabled,
    business_hours_timezone: input.businessHoursTimezone,
    business_hours_start: input.businessHoursStart,
    business_hours_end: input.businessHoursEnd,
  })

  return toAgentSettingsResponse(settings)
}
