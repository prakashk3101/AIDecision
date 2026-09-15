import { describe, expect, it } from 'vitest'
import { composeLatency, describeComposition, modelResponseTimeMs, type LatencyFormula } from './latencyModel'

const formula: LatencyFormula = {
  components: [{ name: 'Vector search', p95Ms: 150 }, { name: 'Rerank', p95Ms: 50 }, { name: 'Orchestration', p95Ms: 20 }],
  modelMultiplier: 1,
  sourceType: 'expert-rule',
  sourceUrl: 'urn:test:latency-formula',
  measuredAt: '2026-08-27T00:00:00Z',
}

const model = { id: 'fast', ttftMs: 400, outputTokensPerSecond: 200, sourceType: 'independent-benchmark' as const }

describe('latency model', () => {
  it('returns overhead only when no model is selected', () => {
    const composed = composeLatency(formula)
    expect(composed).toMatchObject({ p95Ms: 220, overheadMs: 220, modelMs: null, sourceType: 'expert-rule' })
  })

  it('derives model response time from time to first token plus decode at output speed', () => {
    expect(modelResponseTimeMs(model, 600)).toEqual({ ttftMs: 400, decodeMs: 3000, totalMs: 3400 })
  })

  it('grows the estimate with the number of output tokens', () => {
    const short = composeLatency(formula, model, 250)
    const long = composeLatency(formula, model, 600)

    expect(short.p95Ms).toBe(220 + 400 + 1250)
    expect(long.p95Ms).toBe(220 + 400 + 3000)
    expect(long.p95Ms).toBeGreaterThan(short.p95Ms)
  })

  it('favours a faster output speed at the same time to first token', () => {
    const slow = composeLatency(formula, { ...model, id: 'slow', outputTokensPerSecond: 100 }, 600)
    const quick = composeLatency(formula, model, 600)

    expect(slow.modelDecodeMs).toBe(6000)
    expect(quick.modelDecodeMs).toBe(3000)
    expect(quick.p95Ms).toBeLessThan(slow.p95Ms)
  })

  it('applies the model multiplier and keeps a full breakdown', () => {
    const composed = composeLatency({ ...formula, modelMultiplier: 2 }, model, 200)

    expect(composed.modelTtftMs).toBe(800)
    expect(composed.modelDecodeMs).toBe(2000)
    expect(composed.p95Ms).toBe(3020)
    expect(describeComposition(composed)).toBe('Vector search 150ms + Rerank 50ms + Orchestration 20ms + fast time to first token 800ms + fast output (200 tokens @ 200 tok/s) 2000ms')
  })

  it('downgrades the composed source type to the weakest input', () => {
    expect(composeLatency(formula, model, 100).sourceType).toBe('expert-rule')
    expect(composeLatency({ ...formula, sourceType: 'independent-benchmark' }, { ...model, sourceType: 'assumption' }, 100).sourceType).toBe('assumption')
  })

  it('ignores the model term for architectures with no inference step', () => {
    const composed = composeLatency({ ...formula, modelMultiplier: 0 }, model, 600)

    expect(composed.modelMs).toBe(0)
    expect(composed.p95Ms).toBe(220)
  })
})
