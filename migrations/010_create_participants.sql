-- Migration 010: conversation participants (Phase 4)

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  platform_user_id TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT participants_conversation_platform_user_unique
    UNIQUE (conversation_id, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_conversation_id
  ON participants (conversation_id);

CREATE INDEX IF NOT EXISTS idx_participants_platform_user_id
  ON participants (platform_user_id);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
