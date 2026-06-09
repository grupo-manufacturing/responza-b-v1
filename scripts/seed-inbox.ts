import { getSupabaseAdminClient } from '../src/shared/database/index.js'
import { loadEnv } from '../src/shared/config/index.js'

type SeedConversation = {
  externalId: string
  participant: {
    platformUserId: string
    displayName: string
  }
  messages: Array<{
    direction: 'inbound' | 'outbound'
    content: string
    platformMessageId: string
  }>
}

const SEED_CONVERSATIONS: SeedConversation[] = [
  {
    externalId: 'seed-rajesh',
    participant: { platformUserId: '919876543210', displayName: 'Rajesh Kumar' },
    messages: [
      {
        direction: 'inbound',
        content: 'Hi, do you manufacture industrial valves?',
        platformMessageId: 'seed-rajesh-1',
      },
      {
        direction: 'outbound',
        content: 'Yes, we do. What size and quantity do you need?',
        platformMessageId: 'seed-rajesh-2',
      },
      {
        direction: 'inbound',
        content: '2 inch, around 500 units.',
        platformMessageId: 'seed-rajesh-3',
      },
    ],
  },
  {
    externalId: 'seed-priya',
    participant: { platformUserId: '919123456789', displayName: 'Priya Sharma' },
    messages: [
      {
        direction: 'inbound',
        content: 'Can you share your product catalog?',
        platformMessageId: 'seed-priya-1',
      },
      {
        direction: 'outbound',
        content: 'Sure, I will send it over shortly.',
        platformMessageId: 'seed-priya-2',
      },
    ],
  },
]

async function resolveOrganizationId(): Promise<string> {
  const client = getSupabaseAdminClient()
  const email = process.env.SEED_ORGANIZATION_EMAIL?.trim()

  if (email !== undefined && email.length > 0) {
    const { data, error } = await client
      .from('organizations')
      .select('id, email, name')
      .eq('email', email)
      .maybeSingle()

    if (error !== null) {
      throw new Error(`Failed to look up organization: ${error.message}`)
    }

    if (data === null) {
      throw new Error(`No organization found for SEED_ORGANIZATION_EMAIL=${email}`)
    }

    return data.id as string
  }

  const { data, error } = await client
    .from('organizations')
    .select('id, email, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error !== null) {
    throw new Error(`Failed to list organizations: ${error.message}`)
  }

  if (data === null) {
    throw new Error('No organizations found. Register an account first, then run the seed.')
  }

  return data.id as string
}

async function ensureConnectedIntegration(organizationId: string): Promise<string> {
  const client = getSupabaseAdminClient()

  const { data: existing, error: existingError } = await client
    .from('integrations')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('platform', 'whatsapp')
    .maybeSingle()

  if (existingError !== null) {
    throw new Error(`Failed to load integration: ${existingError.message}`)
  }

  if (existing !== null) {
    if (existing.status !== 'connected') {
      const { error: updateError } = await client
        .from('integrations')
        .update({ status: 'connected' })
        .eq('id', existing.id)

      if (updateError !== null) {
        throw new Error(`Failed to connect integration: ${updateError.message}`)
      }
    }

    return existing.id as string
  }

  const { data, error } = await client
    .from('integrations')
    .insert({
      organization_id: organizationId,
      platform: 'whatsapp',
      status: 'connected',
    })
    .select('id')
    .single()

  if (error !== null || data === null) {
    throw new Error(`Failed to create integration: ${error?.message ?? 'unknown error'}`)
  }

  return data.id as string
}

async function ensureChannel(organizationId: string, integrationId: string): Promise<string> {
  const client = getSupabaseAdminClient()

  const { data: existing, error: existingError } = await client
    .from('channels')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('integration_id', integrationId)
    .maybeSingle()

  if (existingError !== null) {
    throw new Error(`Failed to load channel: ${existingError.message}`)
  }

  if (existing !== null) {
    return existing.id as string
  }

  const { data, error } = await client
    .from('channels')
    .insert({
      organization_id: organizationId,
      integration_id: integrationId,
      platform: 'whatsapp',
      display_name: 'Demo WhatsApp',
    })
    .select('id')
    .single()

  if (error !== null || data === null) {
    throw new Error(`Failed to create channel: ${error?.message ?? 'unknown error'}`)
  }

  return data.id as string
}

async function seedConversation(
  organizationId: string,
  channelId: string,
  seed: SeedConversation,
): Promise<void> {
  const client = getSupabaseAdminClient()

  const { data: existingConversation, error: existingConversationError } = await client
    .from('conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('channel_id', channelId)
    .eq('external_id', seed.externalId)
    .maybeSingle()

  if (existingConversationError !== null) {
    throw new Error(`Failed to check conversation: ${existingConversationError.message}`)
  }

  if (existingConversation !== null) {
    return
  }

  const lastMessageAt = new Date().toISOString()

  const { data: conversation, error: conversationError } = await client
    .from('conversations')
    .insert({
      organization_id: organizationId,
      channel_id: channelId,
      external_id: seed.externalId,
      last_message_at: lastMessageAt,
    })
    .select('id')
    .single()

  if (conversationError !== null || conversation === null) {
    throw new Error(`Failed to create conversation: ${conversationError?.message ?? 'unknown error'}`)
  }

  const { data: participant, error: participantError } = await client
    .from('participants')
    .insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      platform_user_id: seed.participant.platformUserId,
      display_name: seed.participant.displayName,
      avatar_url: null,
    })
    .select('id')
    .single()

  if (participantError !== null || participant === null) {
    throw new Error(`Failed to create participant: ${participantError?.message ?? 'unknown error'}`)
  }

  for (const message of seed.messages) {
    const { error: messageError } = await client.from('messages').insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      participant_id: message.direction === 'inbound' ? participant.id : null,
      direction: message.direction,
      platform_message_id: message.platformMessageId,
      content: message.content,
      status: 'sent',
    })

    if (messageError !== null) {
      throw new Error(`Failed to create message: ${messageError.message}`)
    }
  }
}

async function main(): Promise<void> {
  loadEnv()

  const organizationId = await resolveOrganizationId()
  const integrationId = await ensureConnectedIntegration(organizationId)
  const channelId = await ensureChannel(organizationId, integrationId)

  for (const seed of SEED_CONVERSATIONS) {
    await seedConversation(organizationId, channelId, seed)
  }

  console.log('Inbox seed complete.')
  console.log(`Organization: ${organizationId}`)
  console.log('WhatsApp integration: connected')
  console.log(`Conversations: ${SEED_CONVERSATIONS.map((item) => item.externalId).join(', ')}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`Inbox seed failed: ${message}`)
  process.exit(1)
})
