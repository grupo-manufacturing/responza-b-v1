-- Default trial length for new organizations (existing rows unchanged).
ALTER TABLE organizations
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '3 days');
