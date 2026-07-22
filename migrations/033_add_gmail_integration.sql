-- Gmail integration: extend platform constraint and add refresh token columns.

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_platform_check;
ALTER TABLE integrations
  ADD CONSTRAINT integrations_platform_check
  CHECK (platform IN ('whatsapp', 'instagram', 'gmail'));

ALTER TABLE integrations ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_unique_gmail_email
  ON integrations ((metadata->>'email'))
  WHERE platform = 'gmail'
    AND status = 'connected'
    AND metadata->>'email' IS NOT NULL;
