import { Router } from 'express'

import { AppError, isAppError } from '../../shared/errors/index.js'
import {
  processWhatsAppWebhook,
  verifyWhatsAppWebhookChallenge,
} from './whatsapp.webhook.service.js'

export function createWebhooksRouter(): Router {
  const router = Router()

  router.get('/whatsapp', (req, res, next) => {
    try {
      const challenge = verifyWhatsAppWebhookChallenge({
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

  router.post('/whatsapp', (req, res, next) => {
    const rawBody = req.rawBody
    if (rawBody === undefined) {
      next(new AppError(500, 'INTERNAL_ERROR', 'Webhook raw body is unavailable'))
      return
    }

    void processWhatsAppWebhook({
      rawBody,
      signatureHeader:
        typeof req.headers['x-hub-signature-256'] === 'string'
          ? req.headers['x-hub-signature-256']
          : undefined,
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
