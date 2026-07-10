ALTER TABLE organization_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_knowledge_index_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_chunks_select_own ON organization_knowledge_chunks
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY knowledge_index_state_select_own ON organization_knowledge_index_state
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY agent_settings_select_own ON agent_settings
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY agent_settings_update_own ON agent_settings
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY agent_decisions_select_own ON agent_decisions
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());
