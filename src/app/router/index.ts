import { Router } from 'express'

import { createAuthProtectedRouter, createAuthPublicRouter } from '../../modules/auth/auth.routes.js'
import { createBusinessDetailsRouter } from '../../modules/business-details/business-details.routes.js'
import { createConversationsRouter, createInboxRouter } from '../../modules/inbox/inbox.routes.js'
import { createIntegrationsRouter } from '../../modules/integrations/integrations.routes.js'
import { createLeadsRouter } from '../../modules/leads/leads.routes.js'
import { createSubscriptionRouter } from '../../modules/subscription/subscription.routes.js'
import { createWebhooksRouter } from '../../modules/webhooks/webhooks.routes.js'
import {
  authenticateMiddleware,
  requireActiveSubscriptionMiddleware,
  requireIntegrationMiddleware,
  requireTenantMiddleware,
} from '../../shared/middleware/index.js'
import { healthRouter } from './health.routes.js'

export function createAppRouter(): Router {
  const router = Router()

  router.use(healthRouter)
  router.use('/webhooks', createWebhooksRouter())

  const apiRouter = Router()

  apiRouter.use('/auth', createAuthPublicRouter())

  const protectedApiRouter = Router()
  protectedApiRouter.use(authenticateMiddleware)
  protectedApiRouter.use(requireTenantMiddleware)
  protectedApiRouter.use('/auth', createAuthProtectedRouter())
  protectedApiRouter.use('/subscription', createSubscriptionRouter())

  const subscriptionGatedRouter = Router()
  subscriptionGatedRouter.use(requireActiveSubscriptionMiddleware)
  subscriptionGatedRouter.use('/business-details', createBusinessDetailsRouter())
  subscriptionGatedRouter.use('/integrations', createIntegrationsRouter())
  subscriptionGatedRouter.use('/leads', createLeadsRouter())

  const inboxRouter = Router()
  inboxRouter.use(requireIntegrationMiddleware())
  inboxRouter.use('/inbox', createInboxRouter())
  inboxRouter.use('/conversations', createConversationsRouter())
  subscriptionGatedRouter.use(inboxRouter)

  protectedApiRouter.use(subscriptionGatedRouter)

  apiRouter.use(protectedApiRouter)
  router.use('/api', apiRouter)

  return router
}
