import { timingSafeEqual } from 'node:crypto'

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'

import { loadEnv } from '../../shared/config/env.js'
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

const adminListLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.' } },
})

function extractBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

function adminTokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function requireAdmin(req: { headers: { authorization?: string } }): void {
  const env = loadEnv()
  if (env.ADMIN_TOKEN === undefined) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Admin access is not configured')
  }

  const token = extractBearerToken(req.headers.authorization)
  if (token === null || !adminTokensMatch(token, env.ADMIN_TOKEN)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid admin token')
  }
}

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

waitlistRouter.get('/waitlist', adminListLimiter, async (req, res, next) => {
  try {
    requireAdmin(req)

    const supabase = getSupabase()
    if (supabase === null) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Waitlist is not available right now')
    }

    const { data, error } = await supabase
      .from('waitlist_signups')
      .select('email, created_at')
      .order('created_at', { ascending: false })

    if (error !== null) {
      logger.warn('Failed to load waitlist signups', { code: error.code, message: error.message })
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Could not load the waitlist. Please try again.')
    }

    const signups = (data ?? []).map((row) => ({
      email: row.email as string,
      createdAt: row.created_at as string,
    }))

    res.status(200).json({ total: signups.length, signups })
  } catch (error) {
    next(error)
  }
})
