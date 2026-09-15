import { describe, expect, it } from 'vitest'
import { calculateArchitectureCost } from './costEngine.js'
import type { Evidence } from '../catalog/modelCatalog.js'

const price = (category: string, unit: string, value: number): Evidence => ({
  id: `azure:${category}`, provider: 'Azure', service: category, dimension: 'cost', metric: 'pricing.unitPrice', value,
  unit: `USD/${unit}`, sourceType: 'official-api', sourceName: 'Azure Retail Prices', sourceUrl: 'https://prices.azure.com',
  retrievedAt: '2026-08-29T00:00:00Z', confidence: 95, metadata: { resourceCategory: category },
})

describe('cost engine', () => {
  it('multiplies resource quantities by matching official prices', () => {
    const estimate = calculateArchitectureCost({ provider: 'Azure', resources: [
      { category: 'compute', quantity: 730, unit: 'instance-hour', assumptions: [] },
      { category: 'storage', quantity: 100, unit: 'GB-month', assumptions: [] },
    ], assumptions: ['Measured workload'] }, [price('compute', 'instance-hour', 0.2), price('storage', 'GB-month', 0.1)])
    expect(estimate.available).toBe(true)
    expect(estimate.expected).toBe(156)
    expect(estimate.low).toBeLessThan(estimate.expected)
    expect(estimate.high).toBeGreaterThan(estimate.expected)
    expect(estimate.evidenceIds).toEqual(['azure:compute', 'azure:storage'])
  })

  it('adds model token cost to the AI breakdown line', () => {
    const modelEvidence: Evidence = { ...price('model', 'token', 1), id: 'model:pricing', metric: 'model.pricing', sourceType: 'official-documentation' }
    const estimate = calculateArchitectureCost({ provider: 'Azure', resources: [
      { category: 'compute', quantity: 730, unit: 'instance-hour', assumptions: [] },
    ], assumptions: [] }, [price('compute', 'instance-hour', 0.2)], { monthlyCost: 420, evidence: [modelEvidence], assumption: 'Model token cost' })

    expect(estimate.available).toBe(true)
    expect(estimate.breakdown.Ai).toBe(420)
    expect(estimate.expected).toBe(566)
    expect(estimate.evidenceIds).toContain('model:pricing')
    expect(estimate.assumptions).toContain('Model token cost')
  })

  it('rejects official prices from a different provider', () => {
    const estimate = calculateArchitectureCost({ provider: 'AWS', resources: [
      { category: 'compute', quantity: 730, unit: 'instance-hour', assumptions: [] },
    ], assumptions: [] }, [price('compute', 'instance-hour', 0.2)])

    expect(estimate.available).toBe(false)
    expect(estimate.missingCategories).toEqual(['compute'])
    expect(Number.isFinite(estimate.expected)).toBe(false)
  })

  it('keeps cost unavailable when official prices are missing', () => {
    const estimate = calculateArchitectureCost({ provider: 'AWS', resources: [{ category: 'compute', quantity: 1, unit: 'instance-hour', assumptions: [] }], assumptions: [] }, [])
    expect(estimate.available).toBe(false)
    expect(estimate.missingCategories).toEqual(['compute'])
    expect(Number.isFinite(estimate.expected)).toBe(false)
  })
})