CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE organization_ingested_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_ref VARCHAR(500),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_ingested_sources_organization_id
  ON organization_ingested_sources (organization_id);

CREATE TABLE organization_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_ref VARCHAR(500),
  content TEXT NOT NULL,
  embedding vector(3072),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_document_chunks_organization_id
  ON organization_document_chunks (organization_id);

CREATE TABLE organization_knowledge_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('ingest', 'index')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_knowledge_jobs_organization_id
  ON organization_knowledge_jobs (organization_id);

CREATE INDEX idx_org_knowledge_jobs_status
  ON organization_knowledge_jobs (status);

CREATE INDEX idx_org_knowledge_jobs_org_created
  ON organization_knowledge_jobs (organization_id, created_at DESC);

ALTER TABLE organization_ingested_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_knowledge_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_ingested_sources_select_own ON organization_ingested_sources
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY org_ingested_sources_insert_own ON organization_ingested_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY org_ingested_sources_update_own ON organization_ingested_sources
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY org_ingested_sources_delete_own ON organization_ingested_sources
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY org_document_chunks_select_own ON organization_document_chunks
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY org_document_chunks_insert_own ON organization_document_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY org_document_chunks_update_own ON organization_document_chunks
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY org_document_chunks_delete_own ON organization_document_chunks
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY org_knowledge_jobs_select_own ON organization_knowledge_jobs
  FOR SELECT
  TO authenticated
  USING (organization_id = auth.uid());

CREATE POLICY org_knowledge_jobs_insert_own ON organization_knowledge_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY org_knowledge_jobs_update_own ON organization_knowledge_jobs
  FOR UPDATE
  TO authenticated
  USING (organization_id = auth.uid())
  WITH CHECK (organization_id = auth.uid());

CREATE POLICY org_knowledge_jobs_delete_own ON organization_knowledge_jobs
  FOR DELETE
  TO authenticated
  USING (organization_id = auth.uid());
