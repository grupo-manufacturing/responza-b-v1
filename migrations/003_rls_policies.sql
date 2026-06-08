-- Migration 003: Row Level Security policies
--
-- The backend API uses the Supabase service role key, which bypasses RLS.
-- These policies apply when clients use the authenticated role with a user JWT.
-- organizations.id matches auth.uid() — the account is the organization.

-- ---------------------------------------------------------------------------
-- organizations (account)
-- ---------------------------------------------------------------------------

CREATE POLICY organizations_select_own ON organizations
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY organizations_update_own ON organizations
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Registration and subscription changes use the API (service role) only.

-- ---------------------------------------------------------------------------
-- organization_business_profiles
-- ---------------------------------------------------------------------------

CREATE POLICY organization_business_profiles_select_own
  ON organization_business_profiles
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY organization_business_profiles_update_own
  ON organization_business_profiles
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

-- Profile rows are created by the API (service role) on registration.
