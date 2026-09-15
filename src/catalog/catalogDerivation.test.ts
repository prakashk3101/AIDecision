import { beforeAll, describe, expect, it } from 'vitest'
import source from '../../server/catalog/decision-catalog.json'
import { hydrateScoringConfig } from '../scoring/config'
import type { DecisionCatalog } from './catalogClient'
import { calculateComplexityPenalty, calculateControlScore, deriveArchitecture, deriveModel } from './catalogDerivation'

const catalog = source as unknown as DecisionCatalog

beforeAll(() => hydrateScoringConfig(catalog.scoring))

describe('evidence-backed catalog derivation', () => {
  it('calculates architecture metrics and scores from observations', () => {
    const raw = catalog.architectures[0]
    const derived = deriveArchitecture(raw)

    expect(derived.liveMetrics.pricing.baseMonthlyCost).toBe(raw.observations.pricing.components.reduce((sum, item) => sum + item.unitPrice * item.monthlyQuantity, 0))
    expect(derived.liveMetrics.performance.maxRequestsPerSecond).toBe(Math.min(raw.observations.capacity.documentedRequestsPerSecond, raw.observations.capacity.testedRequestsPerSecond))
    expect(derived.security.score).toBe(calculateControlScore(raw.observations.security.controls))
    expect(derived.complexityPenalty).toBe(calculateComplexityPenalty(raw.observations.operations))
    expect(derived.evidence.some(item => item.metric === 'availability.slaPercent' && item.sourceType === raw.observations.availability.sourceType)).toBe(true)
  })

  it('derives independent model task scores and operational scores', () => {
    const raw = catalog.models[0]
    const derived = deriveModel(raw)

    for (const benchmark of raw.observations.qualityBenchmarks) {
      expect(derived.qualityScores[benchmark.task]).toBe(Math.round(benchmark.normalizedScore))
      expect(derived.evidence.some(item => item.metric === `quality.${benchmark.task}`)).toBe(true)
    }
    expect(derived.latencyScore).toBeGreaterThanOrEqual(0)
    expect(derived.reliabilityScore).toBeGreaterThanOrEqual(0)
    expect(derived.securityScore).toBe(calculateControlScore(raw.observations.security.controls))
  })

  it('stores no derived score fields in the source records', () => {
    for (const architecture of source.architectures) {
      expect(architecture).not.toHaveProperty('liveMetrics')
      expect(architecture).not.toHaveProperty('complexityPenalty')
      expect(architecture).not.toHaveProperty('maintainability')
      expect(architecture).not.toHaveProperty('operationalFit')
    }
    for (const model of source.models) {
      expect(model).not.toHaveProperty('qualityScores')
      expect(model).not.toHaveProperty('latencyScore')
      expect(model).not.toHaveProperty('reliabilityScore')
      expect(model).not.toHaveProperty('securityScore')
    }
  })
})