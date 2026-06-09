CREATE INDEX IF NOT EXISTS idx_integrations_instagram_ig_user_id
  ON integrations ((metadata->>'ig_user_id'))
  WHERE platform = 'instagram'
    AND status = 'connected'
    AND metadata->>'ig_user_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integrations_instagram_messaging_account_id
  ON integrations ((metadata->>'messaging_account_id'))
  WHERE platform = 'instagram'
    AND status = 'connected'
    AND metadata->>'messaging_account_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_unique_instagram_ig_user_id
  ON integrations ((metadata->>'ig_user_id'))
  WHERE platform = 'instagram'
    AND status = 'connected'
    AND metadata->>'ig_user_id' IS NOT NULL;
