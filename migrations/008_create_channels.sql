-- Migration 008: internal channel registry (Phase 4 — inbox)
-- Links a connected integration to an inbox channel. RLS in 012_rls_inbox.sql

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('whatsapp', 'instagram', 'indiamart')),
  display_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT channels_integration_unique UNIQUE (integration_id)
);

CREATE INDEX IF NOT EXISTS idx_channels_organization_id
  ON channels (organization_id);

CREATE INDEX IF NOT EXISTS idx_channels_organization_platform
  ON channels (organization_id, platform);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
