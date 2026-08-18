import { loadEnv } from '../../shared/config/index.js'

export function whatsAppGraphApiBaseUrl(): string {
  const { WHATSAPP_GRAPH_VERSION } = loadEnv()
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`
}
