CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliates_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_affiliates_is_active ON affiliates (is_active);
CREATE INDEX IF NOT EXISTS idx_affiliates_created_at ON affiliates (created_at DESC);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES affiliates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_organizations_referred_by_affiliate_id
  ON organizations (referred_by_affiliate_id)
  WHERE referred_by_affiliate_id IS NOT NULL;

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
