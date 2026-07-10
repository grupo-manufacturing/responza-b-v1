ALTER TABLE organization_knowledge_chunks
  DROP CONSTRAINT IF EXISTS organization_knowledge_chunks_source_type_check;

ALTER TABLE organization_knowledge_chunks
  ADD CONSTRAINT organization_knowledge_chunks_source_type_check
  CHECK (source_type IN ('profile', 'catalogue', 'website', 'instagram'));
