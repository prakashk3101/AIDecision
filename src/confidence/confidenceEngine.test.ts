import { describe, expect, it } from 'vitest'
import { calculateConfidence } from './confidenceEngine'
import type { Evidence } from '../catalog/modelCatalog'

const config = {
  sourceReliability: { 'official-api': 100, 'expert-rule': 60 },
  factors: { sourceReliability: 0.3, freshness: 0.2, measurementQuality: 0.3, applicability: 0.2 },
  staleAfterDays: 90, minimumFreshness: 20, assumptionPenalty: 6,
  evidenceWeight: 0.55, requirementWeight: 0.3, stabilityWeight: 0.15,
}

const evidence = (sourceType: Evidence['sourceType'], retrievedAt: string, confidence: number): Evidence => ({
  id: `${sourceType}:price.input`, dimension: 'cost',
  metric: 'price.input', value: 1, unit: 'USD', sourceType, sourceName: 'Source',
  sourceUrl: sourceType === 'official-api' ? 'https://example.com' : 'urn:baseline', retrievedAt, confidence,
})

describe('confidence engine', () => {
  it('reduces confidence for stale, weaker evidence and assumptions', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const strong = calculateConfidence({ evidence: [evidence('official-api', '2025-12-31T00:00:00Z', 100)], requirementCompleteness: 100, scoringStability: 100, assumptionCount: 0, now }, config)
    const weak = calculateConfidence({ evidence: [evidence('expert-rule', '2025-01-01T00:00:00Z', 60)], requirementCompleteness: 100, scoringStability: 100, assumptionCount: 4, now }, config)

    expect(strong.confidence).toBeGreaterThan(weak.confidence)
    expect(strong.freshness).toBeGreaterThan(weak.freshness)
    expect(strong.applicability).toBeGreaterThan(weak.applicability)
  })
})