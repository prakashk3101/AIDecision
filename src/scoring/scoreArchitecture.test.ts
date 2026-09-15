import { describe, expect, it } from 'vitest'
import { architectureCatalog } from '../catalog/architectureCatalog'
import { availabilityScore, capacityScore, capabilityScore, thresholdScore } from './dimensions'
import { calculateOverallScore, type ArchitectureScorecard } from './scoreArchitecture'
import { defaultWeights, normalizeWeights } from './weights'
import { hydrateTestCatalog } from '../testCatalog'

hydrateTestCatalog()

describe('architecture scorecard', () => {
  it('scores thresholds, capacity, capabilities, and availability from requirements', () => {
    expect(thresholdScore(40, 50)).toBe(100)
    expect(thresholdScore(100, 50)).toBe(50)
    expect(capacityScore(5_000, 4_000)).toBe(100)
    expect(capacityScore(2_000, 4_000)).toBe(50)
    expect(capabilityScore(true, false)).toBe(0)
    expect(capabilityScore(false, false)).toBe(100)
    expect(availabilityScore(99.9, 99.99)).toBe(10)
  })

  it('calculates the weighted total and migrates legacy weight profiles', () => {
    const scores = Object.fromEntries(Object.keys(defaultWeights).map(dimension => [dimension, 80])) as ArchitectureScorecard
    expect(calculateOverallScore(scores, defaultWeights)).toBe(80)

    const legacy = normalizeWeights({ architectureFit: 30, performance: 15, security: 15, scalability: 10, costEfficiency: 15, aiFit: 5, complexity: 5, maintainability: 3, operationalFit: 2 })
    expect(legacy.availability).toBeGreaterThan(0)
    expect(Object.values(legacy).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(100)
  })

  it('keeps dynamic metrics and provenance behind the catalog boundary', () => {
    expect(architectureCatalog.every(candidate => candidate.liveMetrics.performance.p95LatencyMs > 0)).toBe(true)
    expect(architectureCatalog.every(candidate => candidate.liveMetrics.pricing.baseMonthlyCost > 0)).toBe(true)
    expect(architectureCatalog.every(candidate => candidate.liveMetrics.availability.targetPercent >= 99.9)).toBe(true)
    expect(architectureCatalog.every(candidate => candidate.metadata.version && candidate.metadata.lastUpdated)).toBe(true)
  })
})