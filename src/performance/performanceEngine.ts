import type { Evidence } from '../catalog/modelCatalog.js'
import { performanceScore } from '../engine/scoringEngine.js'

export type PerformanceEvaluation = {
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
  throughputRps: number | null
  errorRate: number | null
  score: number | null
  confidence: number
  evidenceIds: string[]
  unavailableReason?: string
}

const measuredSources = new Set<Evidence['sourceType']>(['internal-benchmark', 'independent-benchmark'])
const numeric = (evidence: Evidence[], metric: string) => evidence.find(item => item.metric === metric && measuredSources.has(item.sourceType) && typeof item.value === 'number')

export function evaluatePerformance(requiredLatencyMs: number, evidence: Evidence[]): PerformanceEvaluation {
  const p50 = numeric(evidence, 'performance.p50LatencyMs')
  const p95 = numeric(evidence, 'performance.p95LatencyMs')
  const p99 = numeric(evidence, 'performance.p99LatencyMs')
  const throughput = numeric(evidence, 'capacity.testedRequestsPerSecond')
  const errorRate = numeric(evidence, 'performance.errorRatePercent')
  const used = [p50, p95, p99, throughput, errorRate].filter((item): item is Evidence => Boolean(item))
  if (!p95) return { p50LatencyMs: null, p95LatencyMs: null, p99LatencyMs: null, throughputRps: null, errorRate: null, score: null, confidence: 0, evidenceIds: [], unavailableReason: 'No applicable measured latency evidence' }
  return {
    p50LatencyMs: typeof p50?.value === 'number' ? p50.value : null, p95LatencyMs: p95.value as number,
    p99LatencyMs: typeof p99?.value === 'number' ? p99.value : null, throughputRps: typeof throughput?.value === 'number' ? throughput.value : null,
    errorRate: typeof errorRate?.value === 'number' ? errorRate.value : null, score: performanceScore(p95.value as number, requiredLatencyMs),
    confidence: Math.round(used.reduce((sum, item) => sum + item.confidence, 0) / used.length), evidenceIds: used.map(item => item.id),
  }
}