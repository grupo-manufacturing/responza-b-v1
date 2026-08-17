import { createOAuthCallbackRouter } from './createOAuthCallbackRouter.js'

export function createGmailOAuthRouter() {
  return createOAuthCallbackRouter({
    path: '/gmail/callback',
    providerLabel: 'Gmail',
    successType: 'GMAIL_OAUTH_SUCCESS',
    errorType: 'GMAIL_OAUTH_ERROR',
    includeState: true,
  })
}
