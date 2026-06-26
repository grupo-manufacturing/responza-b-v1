ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_direction TEXT;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_last_message_direction_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_last_message_direction_check
  CHECK (
    last_message_direction IS NULL
    OR last_message_direction IN ('inbound', 'outbound')
  );
