CREATE TABLE IF NOT EXISTS organization_business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations (id) ON DELETE CASCADE,
  brand_and_products TEXT,
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
  sample_customer_reply TEXT,
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
  signature_phrases TEXT,
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
