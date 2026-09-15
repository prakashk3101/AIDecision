import type { IncomingMessage, ServerResponse } from 'node:http'

type RateWindow = { count: number; resetAt: number }

export type ApiSecurityOptions = {
  requireAuthentication: boolean
  isDevelopment: boolean
  windowMs?: number
  standardLimit?: number
  aiLimit?: number
  now?: () => number
}

const firstHeader = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value

export function requestOriginMatchesHost(request: IncomingMessage) {
  const origin = firstHeader(request.headers.origin)
  if (!origin) return true
  const host = firstHeader(request.headers['x-forwarded-host']) ?? firstHeader(request.headers.host)
  if (!host) return false
  try {
    return new URL(origin).host.toLowerCase() === host.split(',')[0].trim().toLowerCase()
  } catch {
    return false
  }
}

export function securityHeaders(isDevelopment: boolean) {
  const connectSources = isDevelopment ? "'self' ws: wss:" : "'self'"
  return {
    'Content-Security-Policy': `default-src 'self'; base-uri 'self'; connect-src ${connectSources}; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'`,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }
}

export function createApiSecurityMiddleware(options: ApiSecurityOptions) {
  const windows = new Map<string, RateWindow>()
  const now = options.now ?? Date.now
  const windowMs = options.windowMs ?? 60_000
  const standardLimit = options.standardLimit ?? 120
  const aiLimit = options.aiLimit ?? 20

  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    for (const [name, value] of Object.entries(securityHeaders(options.isDevelopment))) response.setHeader(name, value)
    if (firstHeader(request.headers['x-forwarded-proto']) === 'https') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    const pathname = (request.url ?? '').split('?', 1)[0]
    if (!pathname.startsWith('/api/')) {
      next()
      return
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '') && !requestOriginMatchesHost(request)) {
      response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: 'Cross-origin request rejected.' }))
      return
    }

    const principalId = firstHeader(request.headers['x-ms-client-principal-id'])
    if (options.requireAuthentication && !principalId) {
      response.setHeader('WWW-Authenticate', 'Bearer')
      response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: 'Authentication required.' }))
      return
    }

    const forwardedClient = firstHeader(request.headers['x-azure-clientip'])
    const client = principalId ?? forwardedClient ?? request.socket.remoteAddress ?? 'unknown'
    const isAiRoute = pathname === '/api/analyze' || pathname === '/api/recommendations/explain'
    const limit = isAiRoute ? aiLimit : standardLimit
    const key = `${client}:${isAiRoute ? 'ai' : 'standard'}`
    const currentTime = now()
    let window = windows.get(key)
    if (!window || window.resetAt <= currentTime) {
      window = { count: 0, resetAt: currentTime + windowMs }
      windows.set(key, window)
    }
    window.count += 1
    response.setHeader('RateLimit-Limit', String(limit))
    response.setHeader('RateLimit-Remaining', String(Math.max(0, limit - window.count)))
    response.setHeader('RateLimit-Reset', String(Math.ceil(window.resetAt / 1000)))
    if (window.count > limit) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((window.resetAt - currentTime) / 1000))))
      response.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: 'Too many requests.' }))
      return
    }

    if (windows.size > 10_000) {
      for (const [entryKey, entry] of windows) {
        if (entry.resetAt <= currentTime) windows.delete(entryKey)
      }
      if (windows.size > 10_000) windows.delete(windows.keys().next().value as string)
    }
    next()
  }
}