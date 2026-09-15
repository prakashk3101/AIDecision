import type { ArchitectureCapabilities, ArchitectureCatalogEntry } from './architectureCatalog.js'
import type { Evidence, EvidenceDimension, ModelCatalogEntry, ModelCapability, ModelPricing } from './modelCatalog.js'
import { composeLatency, type LatencyFormula } from '../performance/latencyModel.js'
import { scoringConfig } from '../scoring/config.js'

export type SecurityControls = {
  encryptionAtRest: boolean
  encryptionInTransit: boolean
  privateNetworking: boolean
  rbac: boolean
  managedIdentity: boolean
  auditLogging: boolean
  secretManagement: boolean
}

export type RawArchitectureEntry = Omit<ArchitectureCatalogEntry, 'liveMetrics' | 'security' | 'complexityPenalty' | 'maintainability' | 'operationalFit' | 'evidence' | 'latencyFormula' | 'operations'> & {
  observations: {
    pricing: {
      currency: 'USD'
      region: string
      monthlyUsageProfile: string
      components: Array<{ category: string; unitPrice: number; monthlyQuantity: number; unit: string; sourceType: Evidence['sourceType']; sourceUrl: string }>
      requestUnitCost: number
      retrievedAt: string
    }
    benchmark: {
      latencyFormula: LatencyFormula
      sustainableRequestsPerSecond: number
      errorRatePercent: number
      testConfiguration: { concurrency: number; requests: number; region: string }
      measuredAt: string
      sourceUrl: string
      sourceType: Evidence['sourceType']
    }
    capacity: {
      documentedRequestsPerSecond: number
      testedRequestsPerSecond: number
      sourceUrl: string
      retrievedAt: string
      sourceType?: Evidence['sourceType']
    }
    availability: { slaPercent: number; sourceType: Evidence['sourceType']; sourceUrl: string; retrievedAt: string }
    security: { controls: SecurityControls; evidence: Evidence[] }
    operations: {
      serviceCount: number
      integrationPoints: number
      deploymentUnits: number
      statefulComponents: number
      operationalDependencies: number
      deploymentAutomationPercent: number
      observabilityCoveragePercent: number
      runbookCoveragePercent: number
    }
  }
}

export type ModelBenchmark = {
  task: keyof ModelCatalogEntry['qualityScores']
  benchmark: string
  rawScore: number
  normalizedScore: number
  sourceType: Evidence['sourceType']
  sourceUrl: string
  retrievedAt: string
}

export type RawModelEntry = Omit<ModelCatalogEntry, 'capabilities' | 'qualityScores' | 'latency' | 'latencyScore' | 'reliabilityScore' | 'securityScore' | 'evidence'> & {
  capabilities: Omit<ModelCapability, 'reasoning'>
  observations: {
    qualityBenchmarks: ModelBenchmark[]
    latency: { ttftMs: number; outputTokensPerSecond: number; p50Ms: number; p95Ms: number; benchmark: string; sourceUrl: string; measuredAt: string; sourceType: Evidence['sourceType'] }
    reliability: { availabilityPercent: number; errorRatePercent: number; sourceUrl: string; observedAt: string; sourceType: Evidence['sourceType'] }
    security: { controls: SecurityControls; evidence: Evidence[] }
  }
  evidence: Evidence[]
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const ratio = (value: number, maximum: number) => Math.min(1, Math.max(0, value) / maximum)
const controlLabel = (control: string) => control.replace(/([A-Z])/g, ' $1').trim()
const evidenceDimension = (metric: string): EvidenceDimension => metric.startsWith('pricing') ? 'cost'
  : metric.startsWith('performance') || metric.startsWith('latency') ? 'performance'
    : metric.startsWith('capacity') ? 'scalability'
      : metric.startsWith('availability') ? 'availability'
        : metric.startsWith('quality') ? 'quality'
          : metric.startsWith('reliability') ? 'reliability' : 'security'
const evidenceId = (scope: string, metric: string, sourceUrl: string) => `${scope}:${metric}:${sourceUrl}`.replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 512)
const observedEvidence = (scope: { architectureId?: string; modelId?: string }, metric: string, value: number | string, unit: string, sourceType: Evidence['sourceType'], sourceName: string, sourceUrl: string, retrievedAt: string, confidence: number): Evidence => ({
  id: evidenceId(scope.architectureId ?? scope.modelId ?? 'global', metric, sourceUrl), ...scope, dimension: evidenceDimension(metric),
  metric, value, unit, sourceType, sourceName, sourceUrl, retrievedAt, confidence,
})
const scopedEvidence = (items: Evidence[], scope: { architectureId?: string; modelId?: string }) => items.map(item => ({
  ...item, ...scope, id: item.id || evidenceId(scope.architectureId ?? scope.modelId ?? 'global', item.metric, item.sourceUrl ?? item.sourceName),
  dimension: item.dimension || evidenceDimension(item.metric),
}))

export function calculateControlScore(controls: SecurityControls) {
  const values = Object.values(controls)
  return clamp(values.filter(Boolean).length / values.length * 100)
}

export function calculateComplexityPenalty(operations: RawArchitectureEntry['observations']['operations']) {
  const config = scoringConfig.derivation.complexity
  return clamp(
    ratio(operations.serviceCount, config.serviceCountMaximum) * 100 * config.factorWeight
    + ratio(operations.integrationPoints, config.integrationPointsMaximum) * 100 * config.factorWeight
    + ratio(operations.deploymentUnits, config.deploymentUnitsMaximum) * 100 * config.factorWeight
    + ratio(operations.statefulComponents + operations.operationalDependencies, config.stateAndDependencyMaximum) * 100 * config.factorWeight,
  )
}

export function calculateMaintainability(operations: RawArchitectureEntry['observations']['operations'], complexityPenalty: number) {
  const config = scoringConfig.derivation.maintainability
  return clamp(
    100 - complexityPenalty * config.complexityWeight
    + operations.deploymentAutomationPercent * config.automationWeight
    + operations.observabilityCoveragePercent * config.observabilityWeight
    + operations.runbookCoveragePercent * config.runbookWeight
    + config.baselineAdjustment,
  )
}

export function calculateOperationalReadiness(operations: RawArchitectureEntry['observations']['operations']) {
  return clamp((operations.deploymentAutomationPercent + operations.observabilityCoveragePercent + operations.runbookCoveragePercent) / 3)
}

export function deriveArchitecture(entry: RawArchitectureEntry): ArchitectureCatalogEntry {
  const { observations, ...definition } = entry
  const complexityPenalty = calculateComplexityPenalty(observations.operations)
  const controls = observations.security.controls
  const benchmark = observations.benchmark
  const baseLatency = composeLatency(benchmark.latencyFormula)
  const evidence = [
    ...scopedEvidence(observations.security.evidence, { architectureId: entry.id }),
    ...Object.entries(controls).map(([control, supported]) => observedEvidence({ architectureId: entry.id }, `security.${control}`, String(supported), 'supported', observations.security.evidence[0]?.sourceType ?? 'expert-rule', observations.security.evidence[0]?.sourceName ?? 'Provider security capability documentation', observations.security.evidence[0]?.sourceUrl ?? benchmark.latencyFormula.sourceUrl, observations.security.evidence[0]?.retrievedAt ?? observations.pricing.retrievedAt, 70)),
    ...observations.pricing.components.map(component => observedEvidence({ architectureId: entry.id }, `pricing.${component.category}`, component.unitPrice, `USD/${component.unit}`, component.sourceType, 'Catalog pricing observation', component.sourceUrl, observations.pricing.retrievedAt, component.sourceType === 'official-api' ? 95 : 65)),
    observedEvidence({ architectureId: entry.id }, 'pricing.requestUnitCost', observations.pricing.requestUnitCost, 'USD/request', observations.pricing.components[0]?.sourceType ?? 'expert-rule', 'Catalog pricing observation', observations.pricing.components[0]?.sourceUrl ?? observations.capacity.sourceUrl, observations.pricing.retrievedAt, 65),
    observedEvidence({ architectureId: entry.id }, 'performance.p95LatencyMs', baseLatency.p95Ms, 'ms', baseLatency.sourceType, 'Architecture latency formula (platform overhead, excludes model inference)', benchmark.latencyFormula.sourceUrl, benchmark.latencyFormula.measuredAt, baseLatency.sourceType === 'internal-benchmark' ? 80 : 65),
    observedEvidence({ architectureId: entry.id }, 'performance.errorRatePercent', benchmark.errorRatePercent, 'percent', benchmark.sourceType, 'Architecture workload benchmark', benchmark.sourceUrl, benchmark.measuredAt, benchmark.sourceType === 'internal-benchmark' ? 80 : 65),
    observedEvidence({ architectureId: entry.id }, 'capacity.documentedRequestsPerSecond', observations.capacity.documentedRequestsPerSecond, 'requests/second', observations.capacity.sourceType ?? 'expert-rule', 'Provider service limits', observations.capacity.sourceUrl, observations.capacity.retrievedAt, 90),
    observedEvidence({ architectureId: entry.id }, 'capacity.testedRequestsPerSecond', observations.capacity.testedRequestsPerSecond, 'requests/second', benchmark.sourceType, 'Architecture workload benchmark', benchmark.sourceUrl, benchmark.measuredAt, benchmark.sourceType === 'internal-benchmark' ? 80 : 65),
    observedEvidence({ architectureId: entry.id }, 'availability.slaPercent', observations.availability.slaPercent, 'percent', observations.availability.sourceType, 'Availability observation', observations.availability.sourceUrl, observations.availability.retrievedAt, observations.availability.sourceType === 'official-sla' ? 95 : 65),
    ...Object.entries(observations.operations).map(([metric, value]) => observedEvidence({ architectureId: entry.id }, `operations.${metric}`, value, metric.endsWith('Percent') ? 'percent' : 'count', 'expert-rule', 'Architecture operations assessment', benchmark.sourceUrl, benchmark.measuredAt, 70)),
  ]
  return {
    ...definition,
    operations: {
      serviceCount: observations.operations.serviceCount,
      integrationPoints: observations.operations.integrationPoints,
      deploymentUnits: observations.operations.deploymentUnits,
      statefulComponents: observations.operations.statefulComponents,
    },
    latencyFormula: benchmark.latencyFormula,
    security: { score: calculateControlScore(controls), controls: Object.entries(controls).filter(([, supported]) => supported).map(([control]) => controlLabel(control)) },
    complexityPenalty,
    maintainability: calculateMaintainability(observations.operations, complexityPenalty),
    operationalFit: calculateOperationalReadiness(observations.operations),
    evidence,
    liveMetrics: {
      pricing: {
        baseMonthlyCost: observations.pricing.components.reduce((sum, component) => sum + component.unitPrice * component.monthlyQuantity, 0),
        requestCost: observations.pricing.requestUnitCost,
      },
      performance: {
        p95LatencyMs: baseLatency.p95Ms,
        maxRequestsPerSecond: Math.min(observations.capacity.documentedRequestsPerSecond, observations.capacity.testedRequestsPerSecond),
      },
      availability: { targetPercent: observations.availability.slaPercent },
      benchmark: { source: observations.benchmark.sourceUrl, measuredAt: observations.benchmark.measuredAt },
    },
  }
}

function qualityScores(benchmarks: ModelBenchmark[]): ModelCatalogEntry['qualityScores'] {
  const score = (task: ModelBenchmark['task']) => clamp(benchmarks.find(item => item.task === task)?.normalizedScore ?? 0)
  return { reasoning: score('reasoning'), extraction: score('extraction'), summarization: score('summarization'), rag: score('rag'), agentic: score('agentic') }
}

export function deriveModel(entry: RawModelEntry): ModelCatalogEntry {
  const { observations, capabilities, ...definition } = entry
  const scores = qualityScores(observations.qualityBenchmarks)
  return {
    ...definition,
    capabilities: { ...capabilities, reasoning: scores.reasoning },
    qualityScores: scores,
    latency: { ttftMs: observations.latency.ttftMs, outputTokensPerSecond: observations.latency.outputTokensPerSecond, p50Ms: observations.latency.p50Ms, p95Ms: observations.latency.p95Ms, sourceType: observations.latency.sourceType, sourceUrl: observations.latency.sourceUrl, measuredAt: observations.latency.measuredAt },
    latencyScore: clamp(100 - Math.max(0, observations.latency.p95Ms - scoringConfig.derivation.model.latencyTargetMs) / scoringConfig.derivation.model.latencyMsPerPenaltyPoint),
    reliabilityScore: clamp((observations.reliability.availabilityPercent - scoringConfig.derivation.model.availabilityBaselinePercent) * scoringConfig.derivation.model.availabilityPointsPerPercent - observations.reliability.errorRatePercent * scoringConfig.derivation.model.errorRatePenalty),
    securityScore: calculateControlScore(observations.security.controls),
    evidence: [
      ...scopedEvidence(entry.evidence, { modelId: entry.id }),
      ...scopedEvidence(observations.security.evidence, { modelId: entry.id }),
      ...observations.qualityBenchmarks.map(benchmark => observedEvidence({ modelId: entry.id }, `quality.${benchmark.task}`, benchmark.normalizedScore, 'score/100', benchmark.sourceType, benchmark.benchmark, benchmark.sourceUrl, benchmark.retrievedAt, benchmark.sourceType === 'independent-benchmark' ? 85 : 65)),
      observedEvidence({ modelId: entry.id }, 'latency.p50Ms', observations.latency.p50Ms, 'ms', observations.latency.sourceType, observations.latency.benchmark, observations.latency.sourceUrl, observations.latency.measuredAt, observations.latency.sourceType === 'internal-benchmark' ? 80 : 65),
      observedEvidence({ modelId: entry.id }, 'latency.p95Ms', observations.latency.p95Ms, 'ms', observations.latency.sourceType, observations.latency.benchmark, observations.latency.sourceUrl, observations.latency.measuredAt, observations.latency.sourceType === 'internal-benchmark' ? 80 : 65),
      observedEvidence({ modelId: entry.id }, 'latency.ttftMs', observations.latency.ttftMs, 'ms', observations.latency.sourceType, observations.latency.benchmark, observations.latency.sourceUrl, observations.latency.measuredAt, observations.latency.sourceType === 'independent-benchmark' ? 90 : 65),
      observedEvidence({ modelId: entry.id }, 'latency.outputTokensPerSecond', observations.latency.outputTokensPerSecond, 'tokens/second', observations.latency.sourceType, observations.latency.benchmark, observations.latency.sourceUrl, observations.latency.measuredAt, observations.latency.sourceType === 'independent-benchmark' ? 90 : 65),
      observedEvidence({ modelId: entry.id }, 'reliability.availabilityPercent', observations.reliability.availabilityPercent, 'percent', observations.reliability.sourceType, 'Observed model reliability', observations.reliability.sourceUrl, observations.reliability.observedAt, observations.reliability.sourceType === 'internal-benchmark' ? 75 : 65),
      observedEvidence({ modelId: entry.id }, 'reliability.errorRatePercent', observations.reliability.errorRatePercent, 'percent', observations.reliability.sourceType, 'Observed model reliability', observations.reliability.sourceUrl, observations.reliability.observedAt, observations.reliability.sourceType === 'internal-benchmark' ? 75 : 65),
    ],
  }
}

export type RawDecisionCatalog = {
  catalogVersion: string
  lastUpdated: string
  scoring: unknown
  architectures: RawArchitectureEntry[]
  models: RawModelEntry[]
  platforms: Record<string, Record<string, string>>
}

export type PublishedModelPricing = ModelPricing
export type PublishedArchitectureCapabilities = ArchitectureCapabilities