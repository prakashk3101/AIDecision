import type { Evidence, EvidenceType } from '../catalog/modelCatalog.js'
import { scalabilityScore } from '../engine/scoringEngine.js'

export type ScalabilityEvaluation = { capacity: number | null; capacityRatio: number | null; estimatedCapacity: number | null; estimatedSourceType: EvidenceType | null; score: number | null; confidence: number; evidenceIds: string[]; unavailableReason?: string }

const isCapacityMetric = (item: Evidence) => item.dimension === 'scalability' && /throughput|requestsPerSecond|concurrency|quota/i.test(item.metric) && typeof item.value === 'number'

export function evaluateScalability(requiredRps: number, evidence: Evidence[]): ScalabilityEvaluation {
  const candidates = evidence.filter(isCapacityMetric)
  const capacities = candidates.filter(item => item.sourceType !== 'expert-rule' && item.sourceType !== 'assumption')
  if (!capacities.length) {
    // Unqualified capacity values are still reported as an estimate so the requirement is not blank.
    const estimate = candidates.length ? Math.min(...candidates.map(item => item.value as number)) : null
    return { capacity: null, capacityRatio: null, estimatedCapacity: estimate, estimatedSourceType: candidates[0]?.sourceType ?? null, score: null, confidence: 0, evidenceIds: [], unavailableReason: 'No documented or measured capacity evidence' }
  }
  const capacity = Math.min(...capacities.map(item => item.value as number))
  return { capacity, capacityRatio: capacity / Math.max(1, requiredRps), estimatedCapacity: capacity, estimatedSourceType: capacities[0].sourceType, score: scalabilityScore(capacity, requiredRps), confidence: Math.round(capacities.reduce((sum, item) => sum + item.confidence, 0) / capacities.length), evidenceIds: capacities.map(item => item.id) }
}