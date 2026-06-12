ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS customer_reaction TEXT,
  ADD COLUMN IF NOT EXISTS agent_reaction TEXT;
