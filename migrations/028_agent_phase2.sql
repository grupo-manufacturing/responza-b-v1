ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS business_hours_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS business_hours_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS business_hours_start TEXT NOT NULL DEFAULT '09:00';

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS business_hours_end TEXT NOT NULL DEFAULT '18:00';

ALTER TABLE agent_decisions
  DROP CONSTRAINT IF EXISTS agent_decisions_action_check;

ALTER TABLE agent_decisions
  ADD CONSTRAINT agent_decisions_action_check
  CHECK (action IN ('skip', 'draft', 'send'));

ALTER TABLE agent_decisions
  ADD COLUMN IF NOT EXISTS sent_message_id UUID REFERENCES messages (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_decisions_sent_message_id
  ON agent_decisions (sent_message_id)
  WHERE sent_message_id IS NOT NULL;
