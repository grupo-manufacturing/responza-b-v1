CREATE POLICY integrations_select_own ON integrations
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY integrations_insert_own ON integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY integrations_update_own ON integrations
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY integrations_delete_own ON integrations
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());
