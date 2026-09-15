import type { DecisionResult, WorkloadInput } from '../domain/decisionEngine.js'

type RecommendationApiResponse = { trace?: DecisionResult; error?: string }

export async function requestRecommendation(assessment: WorkloadInput, platform?: string): Promise<DecisionResult> {
  const response = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessment, platform }),
  })
  const payload = await response.json() as RecommendationApiResponse
  if (!response.ok || !payload.trace) throw new Error(payload.error ?? 'Recommendation could not be calculated.')
  return payload.trace
}