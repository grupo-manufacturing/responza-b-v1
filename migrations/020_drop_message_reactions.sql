ALTER TABLE messages
  DROP COLUMN IF EXISTS customer_reaction,
  DROP COLUMN IF EXISTS agent_reaction;
