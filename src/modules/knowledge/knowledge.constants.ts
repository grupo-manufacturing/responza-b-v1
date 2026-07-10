export const KNOWLEDGE_CHUNK_SIZE = 800
export const KNOWLEDGE_CHUNK_OVERLAP = 100

export const KNOWLEDGE_SOURCE_TYPES = [
  'profile',
  'catalogue',
  'website',
  'instagram',
] as const
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number]

export const PROFILE_CORE_SOURCE_KEY = 'core'
export const INSTAGRAM_PROFILE_SOURCE_KEY = 'profile'
export const WEBSITE_HOMEPAGE_SOURCE_KEY = '/'

export type KnowledgeIndexScope = 'full' | 'profile' | 'catalogue' | 'website' | 'instagram'
