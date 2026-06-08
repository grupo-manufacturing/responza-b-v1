-- Migration 006: tenant-scoped platform integrations (Phase 3)
-- Stores platform + connection status only. OAuth tokens deferred to Phase 5+.
-- RLS policies in 007_rls_integrations.sql

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('whatsapp', 'instagram', 'indiamart')),
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected')),
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT integrations_organization_platform_unique UNIQUE (organization_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_integrations_organization_id
  ON integrations (organization_id);

CREATE INDEX IF NOT EXISTS idx_integrations_organization_platform
  ON integrations (organization_id, platform);

CREATE INDEX IF NOT EXISTS idx_integrations_organization_status
  ON integrations (organization_id, status);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
