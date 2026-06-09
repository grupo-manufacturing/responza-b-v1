CREATE POLICY channels_select_own ON channels
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY channels_insert_own ON channels
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY channels_update_own ON channels
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY channels_delete_own ON channels
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY conversations_select_own ON conversations
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY conversations_insert_own ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY conversations_update_own ON conversations
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY conversations_delete_own ON conversations
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY participants_select_own ON participants
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY participants_insert_own ON participants
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY participants_update_own ON participants
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY participants_delete_own ON participants
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY messages_select_own ON messages
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY messages_insert_own ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY messages_update_own ON messages
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY messages_delete_own ON messages
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());
