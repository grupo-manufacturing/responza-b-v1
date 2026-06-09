-- Instagram business account ID indexes for integration lookup
CREATE INDEX IF NOT EXISTS idx_integrations_instagram_business_id
  ON integrations ((metadata->>'business_account_id'))
  WHERE platform = 'instagram'
    AND status = 'connected'
    AND metadata->>'business_account_id' IS NOT NULL;

-- Unique constraint to prevent duplicate Instagram business accounts across organizations
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_unique_instagram_business_id
  ON integrations ((metadata->>'business_account_id'))
  WHERE platform = 'instagram'
    AND status = 'connected'
    AND metadata->>'business_account_id' IS NOT NULL;