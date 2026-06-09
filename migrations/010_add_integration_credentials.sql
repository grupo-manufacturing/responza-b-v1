ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_integrations_whatsapp_phone_number_id
  ON integrations ((metadata->>'phone_number_id'))
  WHERE platform = 'whatsapp'
    AND status = 'connected'
    AND metadata->>'phone_number_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integrations_whatsapp_waba_id
  ON integrations ((metadata->>'waba_id'))
  WHERE platform = 'whatsapp'
    AND status = 'connected'
    AND metadata->>'waba_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_unique_whatsapp_phone_number_id
  ON integrations ((metadata->>'phone_number_id'))
  WHERE platform = 'whatsapp'
    AND status = 'connected'
    AND metadata->>'phone_number_id' IS NOT NULL;
