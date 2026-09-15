import { describe, expect, it } from 'vitest'
import type { Evidence } from '../../src/catalog/modelCatalog.js'
import { createRecommendation, isRecommendationRequest } from './recommendationService.js'

const assessment = {
  name: 'Transactional application', problem: 'Build a transactional application for internal order processing and reporting.', scale: 'Department',
  aiRequirement: 'Not Required', latency: 'Under 500 ms', sensitivity: 'Standard / Internal', monthlyRequests: '100K - 250K', peakRequestsPerMinute: '1000', cloudPreference: 'No preference',
  regulatoryRequirements: [], securityRequirements: [], existingTechnology: '', integrations: '', requiresSourceCitations: null,
  capabilities: ['Transactions'], workloads: ['Web application'], assumptions: [], potentialCompliance: [],
  signals: { predictiveScoring: false, documentProcessing: false, knowledgeRetrieval: false, generativeResponse: false, toolExecution: false, workflowOrchestration: false, humanReview: false, eventStreaming: false, realTime: false },
}

describe('recommendation service', () => {
  it('validates complete requests and rejects malformed assessments', () => {
    expect(isRecommendationRequest({ assessment })).toBe(true)
    expect(isRecommendationRequest({ assessment: { problem: 'short' } })).toBe(false)
    expect(isRecommendationRequest({ assessment: { ...assessment, signals: { ...assessment.signals, realTime: 'yes' } } })).toBe(false)
    expect(isRecommendationRequest({ assessment: { ...assessment, capabilities: Array(21).fill('Capability') } })).toBe(false)
    expect(isRecommendationRequest({ assessment: { ...assessment, integrations: 'x'.repeat(2_001) } })).toBe(false)
    expect(isRecommendationRequest({ assessment, platform: 'Unknown provider' })).toBe(false)
  })

  it('uses scoped Search evidence for deterministic eligibility and cost', async () => {
    const now = new Date().toISOString()
    const base = { architectureId: 'traditional', provider: 'Azure', sourceName: 'Test source', sourceUrl: 'https://example.com/evidence', retrievedAt: now, confidence: 90 } as const
    const prices = [
      ['compute', 'instance-hour'], ['database', 'request'], ['storage', 'GB-month'], ['networking', 'GB'], ['monitoring', '1K-events'], ['security', 'protected-instance-hour'],
    ].map(([resourceCategory, unit]) => ({ ...base, id: `price-${resourceCategory}`, dimension: 'cost', metric: `price.${resourceCategory}`, value: 0.01, unit: `USD/${unit}`, sourceType: 'official-api', metadata: { resourceCategory } }))
    const evidence: Evidence[] = [
      ...prices as Evidence[],
      { ...base, id: 'latency', dimension: 'performance', metric: 'performance.p95LatencyMs', value: 100, unit: 'ms', sourceType: 'internal-benchmark' },
      { ...base, id: 'capacity', dimension: 'scalability', metric: 'capacity.testedRequestsPerSecond', value: 1000, unit: 'requests/second', sourceType: 'internal-benchmark' },
      { ...base, id: 'sla', dimension: 'availability', metric: 'availability.slaPercent', value: 99.9, unit: 'percent', sourceType: 'official-sla' },
    ]
    const queries: Array<{ architectureId?: string; provider?: string }> = []
    const response = await createRecommendation({ assessment, platform: 'Azure' }, { search: async query => {
      queries.push(query)
      const scoped = query.architectureId === 'traditional' ? evidence : []
      return { evidence: scoped, total: scoped.length, source: 'azure-ai-search' }
    } })

    expect(queries.every(query => query.provider === 'Azure')).toBe(true)
    expect(response.recommendation.architectureId).toBe('traditional')
    expect(response.trace.recommended.eligible).toBe(true)
    expect(response.cost.available).toBe(true)
    expect(response.cost.total).toBeGreaterThan(0)
    expect(response.evidence.map(item => item.id)).toEqual(expect.arrayContaining(['latency', 'capacity', 'sla', 'price-compute']))
  })
})