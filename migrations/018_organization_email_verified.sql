ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Existing accounts are treated as verified so login keeps working.
UPDATE organizations
SET email_verified = true
WHERE email_verified = false;


re_y7F9ecwq_6wcDJcdgmb38C4H1sqUTqZL7