-- Roll back the experimental Agent/knowledge foundation.
-- Dropping these tables also removes their indexes, constraints, and RLS policies.

DROP FUNCTION IF EXISTS match_knowledge_chunks(vector(1536), uuid, int);

DROP TABLE IF EXISTS agent_decisions;
DROP TABLE IF EXISTS agent_settings;
DROP TABLE IF EXISTS organization_knowledge_index_state;
DROP TABLE IF EXISTS organization_knowledge_chunks;

-- Keep the vector extension installed. It is harmless and may be reused later.
