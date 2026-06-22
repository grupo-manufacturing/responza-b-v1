import { Router, type NextFunction, type Request, type Response } from 'express'

import { AppError, isAppError } from '../../shared/errors/index.js'
import { processRazorpayWebhook } from './razorpay.webhook.handler.js'

export function createRazorpayWebhookRouter(): Router {
  const router = Router()

  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    const rawBody = req.rawBody
    if (rawBody === undefined) {
      next(new AppError(500, 'INTERNAL_ERROR', 'Webhook raw body is unavailable'))
      return
    }

    const signatureHeader = req.headers['x-razorpay-signature']
    const eventIdHeader = req.headers['x-razorpay-event-id']

    void processRazorpayWebhook({
      rawBody,
      signatureHeader: typeof signatureHeader === 'string' ? signatureHeader : undefined,
      eventIdHeader: typeof eventIdHeader === 'string' ? eventIdHeader : undefined,
      body: req.body,
    })
      .then(() => {
        res.sendStatus(200)
      })
      .catch((error: unknown) => {
        if (isAppError(error) && (error.statusCode === 403 || error.statusCode === 500)) {
          res.sendStatus(error.statusCode)
          return
        }

        next(error)
      })
  })

  return router
}
