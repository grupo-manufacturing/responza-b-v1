ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS suggested_reply TEXT;
