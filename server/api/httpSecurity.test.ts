import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import { createApiSecurityMiddleware, requestOriginMatchesHost, securityHeaders } from './httpSecurity.js'

const requestWithHeaders = (headers: IncomingMessage['headers']) => ({ headers } as IncomingMessage)

const invokeMiddleware = (middleware: ReturnType<typeof createApiSecurityMiddleware>, headers: IncomingMessage['headers'] = {}) => {
  const responseHeaders = new Map<string, string>()
  let status = 0
  let body = ''
  let nextCalled = false
  const request = { headers, method: 'POST', url: '/api/analyze', socket: { remoteAddress: '127.0.0.1' } } as IncomingMessage
  const response = {
    setHeader: (name: string, value: string) => responseHeaders.set(name, value),
    writeHead: (nextStatus: number) => { status = nextStatus },
    end: (value?: string) => { body = value ?? '' },
  } as unknown as ServerResponse
  middleware(request, response, () => { nextCalled = true })
  return { status, body, nextCalled, responseHeaders }
}

describe('HTTP security', () => {
  it('accepts same-origin requests and rejects mismatched origins', () => {
    expect(requestOriginMatchesHost(requestWithHeaders({ host: 'example.com', origin: 'https://example.com' }))).toBe(true)
    expect(requestOriginMatchesHost(requestWithHeaders({ host: 'example.com', origin: 'https://attacker.example' }))).toBe(false)
    expect(requestOriginMatchesHost(requestWithHeaders({ host: 'example.com', origin: 'not a url' }))).toBe(false)
  })

  it('publishes restrictive browser security headers', () => {
    const headers = securityHeaders(false)
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
  })

  it('requires an App Service authenticated principal in production', () => {
    const middleware = createApiSecurityMiddleware({ requireAuthentication: true, isDevelopment: false })
    const anonymous = invokeMiddleware(middleware)
    const authenticated = invokeMiddleware(middleware, { 'x-ms-client-principal-id': 'user-id' })

    expect(anonymous.status).toBe(401)
    expect(anonymous.body).toContain('Authentication required')
    expect(authenticated.nextCalled).toBe(true)
  })

  it('throttles repeated AI requests per authenticated principal', () => {
    const middleware = createApiSecurityMiddleware({ requireAuthentication: true, isDevelopment: false, aiLimit: 1 })
    const headers = { 'x-ms-client-principal-id': 'user-id' }

    expect(invokeMiddleware(middleware, headers).nextCalled).toBe(true)
    const throttled = invokeMiddleware(middleware, headers)
    expect(throttled.status).toBe(429)
    expect(throttled.responseHeaders.get('Retry-After')).toBeDefined()
  })
})