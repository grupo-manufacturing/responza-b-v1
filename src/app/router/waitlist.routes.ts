import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { AppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import { getSupabase } from '../../shared/supabase.js'

const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  website: z.string().max(0).optional(),
})

const waitlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.' } },
})

export const waitlistRouter = Router()

waitlistRouter.post('/waitlist', waitlistLimiter, async (req, res, next) => {
  try {
    const parsed = waitlistSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid waitlist details', parsed.error.flatten().fieldErrors)
    }

    const supabase = getSupabase()
    if (supabase === null) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Waitlist is not available right now')
    }

    const { error } = await supabase
      .from('waitlist_signups')
      .upsert({ email: parsed.data.email }, { onConflict: 'email', ignoreDuplicates: true })

    if (error !== null) {
      logger.warn('Failed to save waitlist signup', { code: error.code, message: error.message })
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Could not join the waitlist. Please try again.')
    }

    res.status(201).json({ status: 'joined' })
  } catch (error) {
    next(error)
  }
})
