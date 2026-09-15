import { describe, expect, it } from 'vitest'
import { estimateResources } from './resourceEstimator.js'

describe('resource estimator', () => {
  it('scales resources from workload and adds only required services', () => {
    const result = estimateResources({
      monthlyRequestCount: 1_000_000, peakRequestsPerSecond: 250, requiresAI: true, requiresGenAI: true,
      signals: { documentProcessing: false, knowledgeRetrieval: true, eventStreaming: false },
      sensitivity: 'High / Confidential', availabilityTargetPercent: 99.99,
    }, 'Azure', 'eastus')

    expect(result.resources.find(item => item.category === 'compute')?.quantity).toBe(6_570)
    expect(result.resources.find(item => item.category === 'database')).toMatchObject({ unit: 'database-hour', quantity: 2_190 })
    expect(result.resources.find(item => item.category === 'search')).toMatchObject({ unit: 'search-unit-hour', quantity: 6_570 })
    expect(result.resources.some(item => item.category === 'messaging')).toBe(false)
    // AI spend comes from published model token pricing, not an infrastructure meter.
    expect(result.resources.some(item => item.category === 'ai')).toBe(false)
  })
})