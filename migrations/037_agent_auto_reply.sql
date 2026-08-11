ALTER TABLE messages
  DROP COLUMN IF EXISTS suggested_reply;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS trigger_message_id UUID REFERENCES messages (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_agent_reply_per_inbound
  ON messages (trigger_message_id)
  WHERE trigger_message_id IS NOT NULL;
