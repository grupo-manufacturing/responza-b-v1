CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('whatsapp', 'instagram', 'indiamart')),
  status TEXT NOT NULL
    CHECK (status IN ('connected', 'disconnected')),
  UNIQUE (organization_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_integrations_organization_id ON integrations (organization_id);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
