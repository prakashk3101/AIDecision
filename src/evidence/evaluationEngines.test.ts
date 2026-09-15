import { describe, expect, it } from 'vitest'
import type { Evidence } from '../catalog/modelCatalog.js'
import { evaluatePerformance } from '../performance/performanceEngine.js'
import { evaluateScalability } from '../scalability/scalabilityEngine.js'
import { evaluateSecurity } from '../security/securityEngine.js'
import { evaluateAvailability } from '../availability/availabilityEngine.js'

const evidence = (id: string, dimension: Evidence['dimension'], metric: string, value: number | string | boolean, sourceType: Evidence['sourceType'] = 'official-documentation'): Evidence => ({
  id, dimension, metric, value: typeof value === 'boolean' ? String(value) : value, sourceType, sourceName: 'Official source', sourceUrl: 'https://example.com', retrievedAt: '2026-08-29T00:00:00Z', confidence: 90,
})

describe('evidence evaluation engines', () => {
  it('leaves performance unavailable without measured evidence', () => expect(evaluatePerformance(100, [])).toMatchObject({ p95LatencyMs: null, score: null, confidence: 0 }))
  it('calculates measured performance and documented capacity', () => {
    expect(evaluatePerformance(100, [evidence('p95', 'performance', 'performance.p95LatencyMs', 80, 'internal-benchmark')]).score).toBe(100)
    expect(evaluateScalability(100, [evidence('cap', 'scalability', 'capacity.requestQuota', 250)])).toMatchObject({ capacityRatio: 2.5, score: 100 })
  })
  it('calculates weighted security coverage and SLA fit', () => {
    const security = evaluateSecurity([{ control: 'rbac', label: 'RBAC', weight: 2 }, { control: 'auditLogging', label: 'Audit logging', weight: 1 }], [evidence('rbac', 'security', 'security.rbac', true)])
    expect(security).toMatchObject({ score: 67, missingControls: [] })
    expect(security.controlStatus).toEqual({ rbac: 'met', auditLogging: 'unknown' })
    expect(evaluateSecurity([{ control: 'rbac', label: 'RBAC', weight: 1 }], [evidence('rbac', 'security', 'security.rbac', false)]).missingControls).toEqual(['rbac'])
    expect(evaluateAvailability(99.9, [evidence('sla', 'availability', 'availability.slaPercent', 99.99, 'official-sla')]).score).toBe(100)
  })
})