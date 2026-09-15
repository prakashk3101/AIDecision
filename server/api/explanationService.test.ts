import { describe, expect, it } from 'vitest'
import { explanationMessages, isExplanationRequest, isRecommendationExplanation } from './explanationService.js'

const recommendation = {
  recommendation: { architectureId: 'traditional', architectureName: 'Traditional Application', overallScore: 72, confidence: 60 },
  alternatives: [], scores: {}, cost: { total: null, currency: 'USD', breakdown: {}, available: false }, evidence: [],
  decision: { whySelected: ['Best supported fit.'], risks: ['Cost evidence is unavailable.'], tradeoffs: [], assumptions: [] },
  trace: {},
}

describe('recommendation explanation service', () => {
  it('accepts deterministic recommendation payloads and rejects incomplete input', () => {
    expect(isExplanationRequest({ recommendation })).toBe(true)
    expect(isExplanationRequest({ recommendation: { recommendation: {} } })).toBe(false)
  })

  it('builds a supplied-facts-only prompt without changing the payload', () => {
    const messages = explanationMessages(recommendation as never)
    expect(messages[0].content).toContain('Do not calculate, infer, estimate, or introduce')
    expect(JSON.parse(messages[1].content)).toEqual(recommendation)
  })

  it('requires the exact structured explanation fields', () => {
    expect(isRecommendationExplanation({ summary: 'Selected.', whySelected: [], tradeoffs: [], risks: [], assumptions: [], evidenceGaps: [] })).toBe(true)
    expect(isRecommendationExplanation({ summary: 'Selected.' })).toBe(false)
  })
})