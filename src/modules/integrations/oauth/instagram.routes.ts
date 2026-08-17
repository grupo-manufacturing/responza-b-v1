import { createOAuthCallbackRouter } from './createOAuthCallbackRouter.js'

export function createInstagramOAuthRouter() {
  return createOAuthCallbackRouter({
    path: '/instagram/callback',
    providerLabel: 'Instagram',
    successType: 'INSTAGRAM_OAUTH_SUCCESS',
    errorType: 'INSTAGRAM_OAUTH_ERROR',
  })
}
