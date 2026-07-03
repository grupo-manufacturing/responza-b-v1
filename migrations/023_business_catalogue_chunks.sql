CREATE TABLE IF NOT EXISTS business_catalogue_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  file_id UUID NOT NULL,
  chunk_index INT NOT NULL CHECK (chunk_index >= 0),
  filename TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, file_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_business_catalogue_chunks_organization_id
  ON business_catalogue_chunks (organization_id);

CREATE INDEX IF NOT EXISTS idx_business_catalogue_chunks_organization_file
  ON business_catalogue_chunks (organization_id, file_id);

ALTER TABLE business_catalogue_chunks ENABLE ROW LEVEL SECURITY;
