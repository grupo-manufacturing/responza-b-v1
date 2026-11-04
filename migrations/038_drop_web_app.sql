-- The web app is retired; the backend only serves health checks.
-- Run against the WEB Supabase project only, after taking a backup.

DROP FUNCTION IF EXISTS match_organization_document_chunks(vector, uuid, int);

-- Inbox (WhatsApp/Instagram)
DROP TABLE IF EXISTS billing_conversation_usage CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS channels CASCADE;

-- Integrations (WhatsApp, Instagram, Gmail)
DROP TABLE IF EXISTS integrations CASCADE;

-- Knowledge base
DROP TABLE IF EXISTS organization_document_chunks CASCADE;
DROP TABLE IF EXISTS organization_ingested_sources CASCADE;
DROP TABLE IF EXISTS organization_knowledge_jobs CASCADE;

-- Billing, business profile, accounts, affiliates
DROP TABLE IF EXISTS razorpay_webhook_events CASCADE;
DROP TABLE IF EXISTS organization_business_profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS affiliates CASCADE;
