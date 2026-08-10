CREATE OR REPLACE FUNCTION match_organization_document_chunks(
  query_embedding vector(3072),
  match_organization_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  source_type VARCHAR(50),
  source_ref VARCHAR(500),
  content TEXT,
  distance DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.source_type,
    c.source_ref,
    c.content,
    (c.embedding <=> query_embedding) AS distance
  FROM organization_document_chunks c
  WHERE c.organization_id = match_organization_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;
