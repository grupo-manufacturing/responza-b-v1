ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS agent_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS send_source TEXT NOT NULL DEFAULT 'human';

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_send_source_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_send_source_check
  CHECK (send_source IN ('human', 'agent'));

CREATE TABLE IF NOT EXISTS agent_reply_usage (
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  reply_count INTEGER NOT NULL DEFAULT 0
    CHECK (reply_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_reply_usage_organization_id
  ON agent_reply_usage (organization_id);

ALTER TABLE agent_reply_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_reply_usage_select_own ON agent_reply_usage
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());
