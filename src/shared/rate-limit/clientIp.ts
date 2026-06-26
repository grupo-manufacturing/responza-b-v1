import type { Request } from 'express'

export function getClientIp(req: Request): string {
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip
  }

  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const firstHop = forwarded.split(',')[0]?.trim()
    if (firstHop !== undefined && firstHop.length > 0) {
      return firstHop
    }
  }

  return req.socket.remoteAddress ?? 'unknown'
}
