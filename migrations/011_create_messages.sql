-- Migration 011: immutable message log (Phase 4)
-- platform_message_id unique when set (webhook deduplication in Phase 5+)

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants (id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  platform_message_id TEXT,
  content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'image', 'video', 'audio', 'document')),
  body TEXT,
  file_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_platform_message_id_unique
  ON messages (platform_message_id)
  WHERE platform_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages (conversation_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
