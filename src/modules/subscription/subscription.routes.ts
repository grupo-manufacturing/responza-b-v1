import { Router } from 'express'

import * as subscriptionService from './subscription.service.js'

export function createSubscriptionRouter(): Router {
  const router = Router()

  router.get('/', (req, res, next) => {
    if (req.auth === undefined) {
      next()
      return
    }

    void subscriptionService
      .getSubscriptionForOrganization(req.auth.organizationId)
      .then((subscription) => {
        res.status(200).json({ subscription })
      })
      .catch(next)
  })

  /**
   * Dev/manual activation until a payment provider (e.g. Stripe) is integrated.
   */
  router.post('/activate', (req, res, next) => {
    if (req.auth === undefined) {
      next()
      return
    }

    void subscriptionService
      .activateSubscription(req.auth.organizationId)
      .then((subscription) => {
        res.status(200).json({ subscription })
      })
      .catch(next)
  })

  return router
}
