-- Migration 004: tenant-scoped leads (Phase 2 — standalone manual CRUD)
-- conversation_id FK deferred until Phase 3 (inbox). RLS in 005_rls_leads.sql

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  conversation_id UUID,
  assigned_to UUID,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'inbox', 'whatsapp', 'instagram', 'indiamart', 'other')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads (organization_id);

CREATE INDEX IF NOT EXISTS idx_leads_organization_status_created
  ON leads (organization_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_leads_organization_created
  ON leads (organization_id, created_at DESC, id DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
