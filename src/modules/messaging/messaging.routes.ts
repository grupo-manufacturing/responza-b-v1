import { Router, type Request, type Response, type NextFunction } from 'express'

import { AppError, isAppError } from '../../shared/errors/index.js'
import { verifyInstagramWebhookChallenge } from './handlers/instagram.handler.js'
import { verifyWhatsAppWebhookChallenge } from './handlers/whatsapp.handler.js'
import { enqueueInstagramWebhook, enqueueWhatsAppWebhook } from './webhook.enqueue.js'

type WebhookHandlers = {
  verifyChallenge: (query: {
    mode?: string
    token?: string
    challenge?: string
  }) => string
  enqueueWebhook: (input: {
    rawBody: Buffer
    signatureHeader: string | undefined
    body: unknown
  }) => Promise<void>
  signatureHeader: string
}

function mountMetaWebhookRoutes(router: Router, path: string, handlers: WebhookHandlers): void {
  router.get(path, (req, res, next) => {
    try {
      const challenge = handlers.verifyChallenge({
        mode: typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined,
        token: typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : undefined,
        challenge:
          typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined,
      })

      res.status(200).send(challenge)
    } catch (error) {
      next(error)
    }
  })

  router.post(path, (req: Request, res: Response, next: NextFunction) => {
    const rawBody = req.rawBody
    if (rawBody === undefined) {
      next(new AppError(500, 'INTERNAL_ERROR', 'Webhook raw body is unavailable'))
      return
    }

    const signatureValue = req.headers[handlers.signatureHeader]
    void handlers
      .enqueueWebhook({
        rawBody,
        signatureHeader: typeof signatureValue === 'string' ? signatureValue : undefined,
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
}

export function createMessagingRouter(): Router {
  const router = Router()

  mountMetaWebhookRoutes(router, '/whatsapp', {
    verifyChallenge: verifyWhatsAppWebhookChallenge,
    enqueueWebhook: enqueueWhatsAppWebhook,
    signatureHeader: 'x-hub-signature-256',
  })

  mountMetaWebhookRoutes(router, '/instagram', {
    verifyChallenge: verifyInstagramWebhookChallenge,
    enqueueWebhook: enqueueInstagramWebhook,
    signatureHeader: 'x-hub-signature',
  })

  return router
}
