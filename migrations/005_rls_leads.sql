CREATE POLICY leads_select_own ON leads
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY leads_insert_own ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY leads_update_own ON leads
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY leads_delete_own ON leads
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());
