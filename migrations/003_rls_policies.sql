CREATE POLICY organizations_select_own ON organizations
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY organizations_update_own ON organizations
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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
