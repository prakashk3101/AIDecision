import { describe, expect, it } from 'vitest'
import type { Evidence } from '../catalog/modelCatalog'
import { validateEvidence } from './validation'

const valid: Evidence = {
  id: 'azure:test-sku:pricing.unitPrice', dimension: 'cost',
  metric: 'pricing.unitPrice', value: 1.25, unit: 'USD/hour', sourceType: 'official-api',
  sourceName: 'Provider API', sourceUrl: 'https://example.com/pricing', retrievedAt: '2026-08-29T00:00:00Z', confidence: 95,
}

describe('evidence validation', () => {
  it('accepts current well-formed evidence', () => {
    expect(validateEvidence(valid, new Date('2026-08-29T12:00:00Z'))).toEqual([])
  })

  it('rejects invalid values and flags stale evidence', () => {
    expect(validateEvidence({ ...valid, value: -1, confidence: 120, sourceUrl: '', retrievedAt: '2025-01-01' }, new Date('2026-08-29')))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ severity: 'error', message: 'Confidence must be between 0 and 100' }),
        expect.objectContaining({ severity: 'error', message: 'Internet evidence requires an HTTPS source URL' }),
        expect.objectContaining({ severity: 'error', message: 'Price and cost values cannot be negative' }),
        expect.objectContaining({ severity: 'warning' }),
      ]))
  })
})