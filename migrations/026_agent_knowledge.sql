CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS organization_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('profile', 'catalogue')),
  source_key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0
    CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_type, source_key, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_organization_id
  ON organization_knowledge_chunks (organization_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org_source
  ON organization_knowledge_chunks (organization_id, source_type, source_key);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON organization_knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS organization_knowledge_index_state (
  organization_id UUID PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
  last_indexed_at TIMESTAMPTZ,
  index_version INTEGER NOT NULL DEFAULT 1
    CHECK (index_version >= 1),
  chunk_count INTEGER NOT NULL DEFAULT 0
    CHECK (chunk_count >= 0),
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  confidence_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.900
    CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('skip', 'draft')),
  reason TEXT,
  confidence NUMERIC(4, 3),
  draft_reply TEXT,
  sources_used JSONB,
  gate_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_organization_id
  ON agent_decisions (organization_id);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_conversation_id
  ON agent_decisions (conversation_id);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_message_id
  ON agent_decisions (message_id);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_created_at
  ON agent_decisions (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_organization_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_key TEXT,
  content TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    k.id,
    k.source_type,
    k.source_key,
    k.content,
    k.metadata,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM organization_knowledge_chunks k
  WHERE k.organization_id = match_organization_id
    AND k.embedding IS NOT NULL
  ORDER BY k.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;
