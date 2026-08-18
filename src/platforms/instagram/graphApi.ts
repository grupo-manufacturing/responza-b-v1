import { loadEnv } from '../../shared/config/index.js'

export function instagramGraphApiBaseUrl(): string {
  const { INSTAGRAM_GRAPH_VERSION } = loadEnv()
  return `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}`
}
