export {
  exchangeInstagramAuthorizationCode,
  type InstagramShortLivedToken,
} from './exchangeAccessToken.js'
export {
  fetchInstagramParticipantProfile,
  instagramConnector,
  isRetryableInstagramAccountError,
  sendInstagramTextMessage,
  type InstagramParticipantProfile,
} from './instagram.connector.js'
export { onboardInstagramUser, type InstagramOnboardedUser } from './onboardUser.js'
export { signInstagramOAuthState, verifyInstagramOAuthState } from './oauthState.js'
export { parseInstagramInboundEvents, type InstagramInboundEvent } from './parseWebhook.js'

export const INSTAGRAM_OAUTH_SCOPES =
  'instagram_business_basic,instagram_business_manage_messages'
