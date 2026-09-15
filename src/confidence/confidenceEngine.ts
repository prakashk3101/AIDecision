import type { Evidence } from '../catalog/modelCatalog.js'
import type { RuntimeScoringConfig } from '../scoring/config.js'

export type ConfidenceInput = {
  evidence: Evidence[]
  requirementCompleteness: number
  scoringStability: number
  assumptionCount: number
  now?: Date
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export function calculateConfidence(input: ConfidenceInput, config: RuntimeScoringConfig['confidence']) {
  const now = input.now ?? new Date()
  const sourceReliability = input.evidence.length
    ? input.evidence.reduce((sum, item) => sum + (config.sourceReliability[item.sourceType] ?? 50), 0) / input.evidence.length
    : 0
  const freshness = input.evidence.length
    ? input.evidence.reduce((sum, item) => {
      const ageDays = Math.max(0, (now.getTime() - Date.parse(item.retrievedAt)) / 86_400_000)
      return sum + Math.max(config.minimumFreshness, 100 - ageDays / config.staleAfterDays * 100)
    }, 0) / input.evidence.length
    : 0
  const measurementQuality = input.evidence.length ? input.evidence.reduce((sum, item) => sum + item.confidence, 0) / input.evidence.length : 0
  const applicability = clamp(100 - input.assumptionCount * config.assumptionPenalty)
  const evidenceConfidence = sourceReliability * config.factors.sourceReliability
    + freshness * config.factors.freshness
    + measurementQuality * config.factors.measurementQuality
    + applicability * config.factors.applicability
  const confidence = clamp(evidenceConfidence * config.evidenceWeight
    + input.requirementCompleteness * config.requirementWeight
    + input.scoringStability * config.stabilityWeight)
  return { confidence, sourceReliability: clamp(sourceReliability), freshness: clamp(freshness), measurementQuality: clamp(measurementQuality), applicability }
}