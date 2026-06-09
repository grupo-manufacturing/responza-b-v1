CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads (organization_id);

CREATE INDEX IF NOT EXISTS idx_leads_organization_status_created
  ON leads (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_organization_created
  ON leads (organization_id, created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
