DROP INDEX IF EXISTS idx_messages_agent_reply_per_inbound;

ALTER TABLE messages
  DROP COLUMN IF EXISTS trigger_message_id;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS suggested_reply TEXT;
