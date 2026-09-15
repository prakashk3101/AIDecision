import { describe, expect, it } from 'vitest'
import { calculateLLMCost, modelCatalog } from './modelCatalog'
import { hydrateTestCatalog } from '../testCatalog'

hydrateTestCatalog()

describe('model catalog pricing', () => {
  it('provides decision-grade pricing metadata for every model deployment', () => {
    expect(modelCatalog.length).toBeGreaterThanOrEqual(20)
    expect(new Set(modelCatalog.map(model => model.id)).size).toBe(modelCatalog.length)

    for (const model of modelCatalog) {
      expect(model.name.length).toBeGreaterThan(0)
      expect(model.hostingProviders.length).toBeGreaterThan(0)
      expect(model.pricing.inputPer1M).toBeGreaterThanOrEqual(0)
      expect(model.pricing.outputPer1M).toBeGreaterThanOrEqual(0)
      expect(model.pricing.sourceUrl).toMatch(/^https:\/\//)
      expect(model.pricing.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('calculates a finite monthly breakdown for every listed model', () => {
    for (const model of modelCatalog) {
      const cost = calculateLLMCost(model, {
        requestsPerMonth: 100_000,
        inputTokensPerRequest: 1_000,
        outputTokensPerRequest: 300,
        cachedInputTokensPerRequest: 250,
      })

      expect(cost.inputCost).toBeGreaterThanOrEqual(0)
      expect(cost.cachedCost).toBeGreaterThanOrEqual(0)
      expect(cost.outputCost).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(cost.total)).toBe(true)
      expect(cost.total).toBeCloseTo(cost.inputCost + cost.cachedCost + cost.outputCost)
    }
  })
})