ALTER TABLE organization_business_profiles
  DROP COLUMN IF EXISTS brand_and_products,
  DROP COLUMN IF EXISTS customer_tone,
  DROP COLUMN IF EXISTS sample_customer_reply,
  DROP COLUMN IF EXISTS common_conversation_types,
  DROP COLUMN IF EXISTS customer_message_language,
  DROP COLUMN IF EXISTS signature_phrases,
  DROP COLUMN IF EXISTS ai_restrictions;

ALTER TABLE organization_business_profiles
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_page_url TEXT,
  ADD COLUMN IF NOT EXISTS business_description TEXT,
  ADD COLUMN IF NOT EXISTS catalogue_files JSONB NOT NULL DEFAULT '[]'::jsonb;
