CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('whatsapp', 'instagram', 'indiamart')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_organization_id ON channels (organization_id);

CREATE INDEX IF NOT EXISTS idx_channels_organization_platform
  ON channels (organization_id, platform);

CREATE INDEX IF NOT EXISTS idx_channels_integration_id ON channels (integration_id);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_organization_id ON conversations (organization_id);

CREATE INDEX IF NOT EXISTS idx_conversations_organization_last_message
  ON conversations (organization_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_channel_id ON conversations (channel_id);

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  platform_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_organization_id ON participants (organization_id);

CREATE INDEX IF NOT EXISTS idx_participants_conversation_id ON participants (conversation_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants (id) ON DELETE SET NULL,
  direction TEXT NOT NULL
    CHECK (direction IN ('inbound', 'outbound')),
  platform_message_id TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, platform_message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_organization_id ON messages (organization_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at ASC);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
