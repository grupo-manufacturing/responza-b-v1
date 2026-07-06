DROP POLICY IF EXISTS agent_reply_usage_select_own ON agent_reply_usage;

DROP TABLE IF EXISTS agent_reply_usage;

ALTER TABLE organizations
  DROP COLUMN IF EXISTS agent_enabled;

-- messages.send_source is retained for historical outbound rows tagged as agent.
