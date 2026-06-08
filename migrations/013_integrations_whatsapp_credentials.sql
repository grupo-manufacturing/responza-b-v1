-- Migration 013: WhatsApp credentials on integrations (Phase 5)
-- Plain access_token + routing metadata for Embedded Signup and webhooks

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_integrations_whatsapp_phone_number_id
  ON integrations ((metadata->>'phone_number_id'))
  WHERE platform = 'whatsapp' AND status = 'connected';

CREATE INDEX IF NOT EXISTS idx_integrations_whatsapp_waba_id
  ON integrations ((metadata->>'waba_id'))
  WHERE platform = 'whatsapp' AND status = 'connected';
