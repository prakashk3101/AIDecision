import type { Evidence } from '../catalog/modelCatalog.js'

export type NormalizedMetric<T> = {
  value: T | null
  evidenceIds: string[]
  confidence: number
}

export type NormalizedCostMetrics = {
  unitPrice: NormalizedMetric<number>
  unit: string | null
  monthlyEstimatedCost: NormalizedMetric<number>
  requestCost: NormalizedMetric<number>
  inputTokenCost: NormalizedMetric<number>
  outputTokenCost: NormalizedMetric<number>
  cachedInputCost: NormalizedMetric<number>
}

export type NormalizedPerformanceMetrics = {
  p50LatencyMs: NormalizedMetric<number>
  p95LatencyMs: NormalizedMetric<number>
  p99LatencyMs: NormalizedMetric<number>
  throughputRps: NormalizedMetric<number>
  errorRate: NormalizedMetric<number>
}

export type NormalizedScalabilityMetrics = {
  maxInstances: NormalizedMetric<number>
  maxReplicas: NormalizedMetric<number>
  maxPartitions: NormalizedMetric<number>
  maxThroughput: NormalizedMetric<number>
  concurrencyLimit: NormalizedMetric<number>
  requestQuota: NormalizedMetric<number>
}

export type NormalizedAvailabilityMetrics = {
  slaPercent: NormalizedMetric<number>
  multiZoneSupport: NormalizedMetric<boolean>
  multiRegionSupport: NormalizedMetric<boolean>
}

export type NormalizedSecurityMetrics = {
  encryptionAtRest: NormalizedMetric<boolean>
  encryptionInTransit: NormalizedMetric<boolean>
  privateNetworking: NormalizedMetric<boolean>
  rbac: NormalizedMetric<boolean>
  managedIdentityOrEquivalent: NormalizedMetric<boolean>
  auditLogging: NormalizedMetric<boolean>
  secretManagement: NormalizedMetric<boolean>
  customerManagedKeys: NormalizedMetric<boolean>
  securityGuardrails: NormalizedMetric<boolean>
}

export type NormalizedModelFacts = {
  contextWindow: NormalizedMetric<number>
  modalities: NormalizedMetric<string[]>
  toolCalling: NormalizedMetric<boolean>
  structuredOutput: NormalizedMetric<boolean>
  officialPricing: Evidence[]
  benchmarkResults: Evidence[]
}

export const unavailableMetric = <T>(): NormalizedMetric<T> => ({ value: null, evidenceIds: [], confidence: 0 })