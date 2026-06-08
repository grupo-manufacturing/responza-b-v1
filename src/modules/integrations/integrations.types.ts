export type WhatsAppIntegrationMetadata = {
  phone_number_id: string
  waba_id: string
  business_id?: string
}

export type IntegrationPublicMetadata = {
  phoneNumberId?: string
  wabaId?: string
  businessId?: string
}

export function toPublicWhatsAppMetadata(
  metadata: Record<string, unknown>,
): IntegrationPublicMetadata | undefined {
  const phoneNumberId =
    typeof metadata.phone_number_id === 'string' ? metadata.phone_number_id : undefined
  const wabaId = typeof metadata.waba_id === 'string' ? metadata.waba_id : undefined
  const businessId = typeof metadata.business_id === 'string' ? metadata.business_id : undefined

  if (phoneNumberId === undefined && wabaId === undefined && businessId === undefined) {
    return undefined
  }

  return { phoneNumberId, wabaId, businessId }
}

export function normalizeWhatsAppMetadata(
  sessionInfo: Record<string, unknown>,
): WhatsAppIntegrationMetadata {
  const phoneNumberId =
    typeof sessionInfo.phone_number_id === 'string' ? sessionInfo.phone_number_id.trim() : ''
  const wabaId = typeof sessionInfo.waba_id === 'string' ? sessionInfo.waba_id.trim() : ''
  const businessId =
    typeof sessionInfo.business_id === 'string' ? sessionInfo.business_id.trim() : undefined

  return {
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    ...(businessId !== undefined && businessId.length > 0 ? { business_id: businessId } : {}),
  }
}
