import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestRecommendation } from './recommendationClient.js'

afterEach(() => vi.unstubAllGlobals())

describe('recommendation client', () => {
  it('returns the deterministic trace from the API', async () => {
    const trace = { generatedAt: '2026-01-01T00:00:00.000Z' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trace }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestRecommendation({ name: 'assessment' } as never)).resolves.toBe(trace)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ assessment: { name: 'assessment' } })
  })

  it('surfaces the server error when recommendation fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Evidence search failed.' }) }))
    await expect(requestRecommendation({} as never)).rejects.toThrow('Evidence search failed.')
  })
})