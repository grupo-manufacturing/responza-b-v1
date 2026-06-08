-- Migration 002: one business-details profile per organization (account)
-- RLS policies are defined in 003_rls_policies.sql

CREATE TABLE IF NOT EXISTS organization_business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations (id) ON DELETE CASCADE,
  -- A: What is your brand name and what do you sell?
  brand_and_products TEXT,
  -- B: What tone do you use when talking to your customers?
  customer_tone TEXT CHECK (
    customer_tone IS NULL
    OR customer_tone IN (
      'very_formal_sir_madam',
      'semi_formal_friendly',
      'casual_like_friend',
      'hinglish_local_feel',
      'fully_regional_language'
    )
  ),
  -- C: Sample reply for "Is this product available?"
  sample_customer_reply TEXT,
  -- D: Most common customer conversations
  common_conversation_types TEXT CHECK (
    common_conversation_types IS NULL
    OR common_conversation_types IN (
      'order_status_tracking',
      'product_enquiries',
      'complaints_returns',
      'payment_issues',
      'all_of_the_above'
    )
  ),
  -- E: Language customers mostly message in
  customer_message_language TEXT CHECK (
    customer_message_language IS NULL
    OR customer_message_language IN (
      'english',
      'hindi',
      'hinglish',
      'regional',
      'mix_of_everything'
    )
  ),
  -- F: Words, phrases or offers you always use
  signature_phrases TEXT,
  -- G: What should the AI never say
  ai_restrictions TEXT CHECK (
    ai_restrictions IS NULL
    OR ai_restrictions IN (
      'never_mention_competitors',
      'never_offer_discounts_without_approval',
      'never_discuss_refunds_directly',
      'never_use_slang',
      'no_restrictions'
    )
  ),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_business_profiles_organization_id
  ON organization_business_profiles (organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_business_profiles_completed_at
  ON organization_business_profiles (completed_at);

ALTER TABLE organization_business_profiles ENABLE ROW LEVEL SECURITY;
