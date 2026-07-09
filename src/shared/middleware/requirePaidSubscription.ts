import type { NextFunction, Request, Response } from 'express'

import { getSubscriptionForOrganization } from '../../modules/subscription/subscription.service.js'
import { AppError } from '../errors/index.js'

export async function requirePaidSubscriptionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.auth === undefined) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'))
      return
    }

    const subscription = await getSubscriptionForOrganization(req.auth.organizationId)
    if (!subscription.hasAccess) {
      next(
        new AppError(
          402,
          'SUBSCRIPTION_REQUIRED',
          'Your free trial has ended. Subscribe to continue using Responza AI.',
          { subscription },
        ),
      )
      return
    }

    if (subscription.isTrialing) {
      next(
        new AppError(
          403,
          'FORBIDDEN',
          'Subscribe to access this feature.',
          { subscription },
        ),
      )
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}
