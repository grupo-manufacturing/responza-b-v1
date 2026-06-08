import { Router } from 'express'

import * as webhooksService from './webhooks.service.js'

export function createWebhooksRouter(): Router {
  const router = Router()

  router.get('/whatsapp', (req, res) => {
    const challenge = webhooksService.verifyWhatsAppWebhookChallenge(req.query)
    if (challenge === null) {
      res.sendStatus(403)
      return
    }

    res.status(200).send(challenge)
  })

  router.post('/whatsapp', (req, res, next) => {
    const signatureHeader = req.header('x-hub-signature-256')
    const rawBody = req.rawBody ?? ''

    void webhooksService
      .handleWhatsAppWebhook(signatureHeader, rawBody, req.body)
      .then(() => {
        res.sendStatus(200)
      })
      .catch(next)
  })

  return router
}
