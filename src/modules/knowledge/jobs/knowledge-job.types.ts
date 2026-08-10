export type KnowledgeJobType = 'ingest' | 'index'

export type KnowledgeJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export type KnowledgeJobRecord = {
  id: string
  organization_id: string
  type: KnowledgeJobType
  status: KnowledgeJobStatus
  error: string | null
  attempts: number
  max_attempts: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

export type IngestedSourceRecord = {
  id: string
  organization_id: string
  source_type: string
  source_ref: string | null
  content: string
  created_at: string
}

export type IngestedSourceInsert = {
  source_type: string
  source_ref: string | null
  content: string
}

export type DocumentChunkRecord = {
  id: string
  organization_id: string
  source_type: string
  source_ref: string | null
  content: string
  embedding: number[] | null
  created_at: string
}

export type DocumentChunkInsert = {
  source_type: string
  source_ref: string | null
  content: string
  embedding: number[] | null
}
