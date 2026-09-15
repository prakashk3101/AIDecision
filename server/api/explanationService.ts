import type { RecommendationResponse } from './recommendationService.js'

export type RecommendationExplanation = {
  summary: string
  whySelected: string[]
  tradeoffs: string[]
  risks: string[]
  assumptions: string[]
  evidenceGaps: string[]
}

export function isExplanationRequest(value: unknown): value is { recommendation: RecommendationResponse } {
  if (!value || typeof value !== 'object') return false
  const recommendation = (value as { recommendation?: Partial<RecommendationResponse> }).recommendation
  return Boolean(
    recommendation
      && typeof recommendation.recommendation?.architectureId === 'string'
      && typeof recommendation.recommendation.architectureName === 'string'
      && recommendation.decision
      && Array.isArray(recommendation.decision.whySelected)
      && Array.isArray(recommendation.decision.risks)
      && Array.isArray(recommendation.decision.tradeoffs)
      && Array.isArray(recommendation.decision.assumptions)
      && Array.isArray(recommendation.evidence),
  )
}

export function explanationMessages(recommendation: RecommendationResponse) {
  return [
    {
      role: 'system',
      content: 'Explain the supplied deterministic architecture decision. Use only facts present in the supplied JSON. Do not calculate, infer, estimate, or introduce any metric, price, benchmark, SLA, score, security capability, evidence, product claim, or recommendation. Preserve unavailable and missing evidence as unavailable or missing. Return only valid JSON with this exact shape: {"summary":"string","whySelected":["string"],"tradeoffs":["string"],"risks":["string"],"assumptions":["string"],"evidenceGaps":["string"]}. Keep each list to at most 8 concise items. The deterministic recommendation and scores are authoritative and must not be changed.',
    },
    { role: 'user', content: JSON.stringify(recommendation) },
  ]
}

export function isRecommendationExplanation(value: unknown): value is RecommendationExplanation {
  if (!value || typeof value !== 'object') return false
  const explanation = value as Partial<RecommendationExplanation>
  const stringList = (items: unknown) => Array.isArray(items) && items.length <= 8 && items.every(item => typeof item === 'string' && item.trim().length > 0)
  return typeof explanation.summary === 'string'
    && explanation.summary.trim().length > 0
    && stringList(explanation.whySelected)
    && stringList(explanation.tradeoffs)
    && stringList(explanation.risks)
    && stringList(explanation.assumptions)
    && stringList(explanation.evidenceGaps)
}