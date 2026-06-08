-- Migration 009: inbox conversations (Phase 4)
-- Auto-created by platform webhooks/connectors in Phase 5+ — not user-created

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_channel_external_unique UNIQUE (channel_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_organization_id
  ON conversations (organization_id);

CREATE INDEX IF NOT EXISTS idx_conversations_organization_channel
  ON conversations (organization_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_conversations_organization_last_message
  ON conversations (organization_id, last_message_at DESC, id DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
