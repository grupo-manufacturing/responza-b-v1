CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'expired')),
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  subscription_period_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations (email);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations (created_at);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON organizations (subscription_status);
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at ON organizations (trial_ends_at);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
