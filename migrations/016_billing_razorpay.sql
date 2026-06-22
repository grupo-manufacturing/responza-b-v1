ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS conversation_limit INTEGER
    CHECK (conversation_limit IS NULL OR conversation_limit > 0),
  ADD COLUMN IF NOT EXISTS subscription_period_starts_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_razorpay_customer_id
  ON organizations (razorpay_customer_id)
  WHERE razorpay_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_razorpay_subscription_id
  ON organizations (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_conversation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_conversation_usage_unique_period
    UNIQUE (organization_id, conversation_id, billing_period_start)
);

CREATE INDEX IF NOT EXISTS idx_billing_conversation_usage_org_period
  ON billing_conversation_usage (organization_id, billing_period_start);

CREATE INDEX IF NOT EXISTS idx_billing_conversation_usage_conversation_id
  ON billing_conversation_usage (conversation_id);

CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT razorpay_webhook_events_event_id_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_event_type
  ON razorpay_webhook_events (event_type);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_processed_at
  ON razorpay_webhook_events (processed_at DESC);

ALTER TABLE billing_conversation_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE razorpay_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_conversation_usage_select_own ON billing_conversation_usage
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());
