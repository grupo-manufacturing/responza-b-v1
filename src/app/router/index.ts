import { Router } from 'express'

import { createAuthProtectedRouter, createAuthPublicRouter } from '../../modules/auth/auth.routes.js'
import { createBusinessRouter } from '../../modules/business/business.routes.js'
import { createConversationsRouter } from '../../modules/inbox/inbox.routes.js'
import { createIntegrationsRouter } from '../../modules/integrations/integrations.routes.js'
import { createInstagramOAuthRouter } from '../../modules/integrations/oauth/instagram.routes.js'
import { createLeadsRouter } from '../../modules/leads/leads.routes.js'
import { createMessagingRouter } from '../../modules/messaging/messaging.routes.js'
import { createSubscriptionRouter } from '../../modules/subscription/subscription.routes.js'
import {
  authenticateMiddleware,
  requireActiveSubscriptionMiddleware,
} from '../../shared/middleware/index.js'
import { healthRouter } from './health.routes.js'

export function createAppRouter(): Router {
  const router = Router()

  router.use(healthRouter)
  router.use('/auth', createInstagramOAuthRouter())
  router.use('/webhooks', createMessagingRouter())

  const apiRouter = Router()

  apiRouter.use('/auth', createAuthPublicRouter())

  const protectedApiRouter = Router()
  protectedApiRouter.use(authenticateMiddleware)
  protectedApiRouter.use('/auth', createAuthProtectedRouter())
  protectedApiRouter.use('/subscription', createSubscriptionRouter())

  const subscriptionGatedRouter = Router()
  subscriptionGatedRouter.use(requireActiveSubscriptionMiddleware)
  subscriptionGatedRouter.use('/business', createBusinessRouter())
  subscriptionGatedRouter.use('/leads', createLeadsRouter())
  subscriptionGatedRouter.use('/integrations', createIntegrationsRouter())
  subscriptionGatedRouter.use('/conversations', createConversationsRouter())

  protectedApiRouter.use(subscriptionGatedRouter)

  apiRouter.use(protectedApiRouter)
  router.use('/api', apiRouter)

  return router
}
