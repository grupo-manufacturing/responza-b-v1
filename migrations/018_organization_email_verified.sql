ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Existing accounts are treated as verified so login keeps working.
UPDATE organizations
SET email_verified = true
WHERE email_verified = false;