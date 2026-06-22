import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import {
  activateSubscriptionBodySchema,
  cancelSubscriptionBodySchema,
  checkoutBodySchema,
  type ActivateSubscriptionBody,
  type CancelSubscriptionBody,
  type CheckoutBody,
} from './subscription.schemas.js'
import * as subscriptionService from './subscription.service.js'

export function createSubscriptionRouter(): Router {
  const router = Router()

  router.get('/plans', (_req, res) => {
    res.status(200).json(subscriptionService.getBillingPlansCatalog())
  })

  router.get('/', (req, res, next) => {
    void subscriptionService
      .getSubscriptionForOrganization(req.auth!.organizationId)
      .then((subscription) => {
        res.status(200).json({ subscription })
      })
      .catch(next)
  })

  router.post('/checkout', validateRequest({ body: checkoutBodySchema }), (req, res, next) => {
    const { plan } = req.body as CheckoutBody

    void subscriptionService
      .createSubscriptionCheckout(req.auth!.organizationId, plan)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post(
    '/cancel',
    validateRequest({ body: cancelSubscriptionBodySchema }),
    (req, res, next) => {
      const { cancelAtCycleEnd } = req.body as CancelSubscriptionBody

      void subscriptionService
        .cancelSubscription(req.auth!.organizationId, cancelAtCycleEnd)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  router.post('/activate', validateRequest({ body: activateSubscriptionBodySchema }), (req, res, next) => {
    const { plan } = req.body as ActivateSubscriptionBody

    void subscriptionService
      .activateSubscription(req.auth!.organizationId, plan)
      .then((subscription) => {
        res.status(200).json({ subscription })
      })
      .catch(next)
  })

  router.post('/sync', (req, res, next) => {
    void subscriptionService
      .syncSubscriptionFromRazorpay(req.auth!.organizationId)
      .then((subscription) => {
        res.status(200).json({ subscription })
      })
      .catch(next)
  })

  return router
}
