import type { Evidence } from '../catalog/modelCatalog.js'

export type EvidenceValidationIssue = {
  severity: 'error' | 'warning'
  metric: string
  message: string
}

const internetSourceTypes = new Set<Evidence['sourceType']>([
  'official-api',
  'official-documentation',
  'official-sla',
  'independent-benchmark',
])

export function validateEvidence(item: Evidence, now = new Date(), staleAfterDays = 90): EvidenceValidationIssue[] {
  const issues: EvidenceValidationIssue[] = []
  if (!item.id?.trim()) issues.push({ severity: 'error', metric: item.metric, message: 'Evidence ID is required' })
  if (!item.dimension) issues.push({ severity: 'error', metric: item.metric, message: 'Evidence dimension is required' })
  if (!item.metric.trim()) issues.push({ severity: 'error', metric: item.metric, message: 'Metric is required' })
  if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 100) issues.push({ severity: 'error', metric: item.metric, message: 'Confidence must be between 0 and 100' })
  if (internetSourceTypes.has(item.sourceType) && !item.sourceUrl?.startsWith('https://')) issues.push({ severity: 'error', metric: item.metric, message: 'Internet evidence requires an HTTPS source URL' })
  const retrievedAt = Date.parse(item.retrievedAt)
  if (!Number.isFinite(retrievedAt)) {
    issues.push({ severity: 'error', metric: item.metric, message: 'Retrieved date is invalid' })
  } else if (now.getTime() - retrievedAt > staleAfterDays * 86_400_000) {
    issues.push({ severity: 'warning', metric: item.metric, message: `Evidence is older than ${staleAfterDays} days` })
  }
  if (typeof item.value === 'number') {
    if (/price|cost/i.test(item.metric) && item.value < 0) issues.push({ severity: 'error', metric: item.metric, message: 'Price and cost values cannot be negative' })
    if (/latency/i.test(item.metric) && item.value <= 0) issues.push({ severity: 'error', metric: item.metric, message: 'Latency must be greater than zero' })
    if (/throughput|requestsPerSecond|quota/i.test(item.metric) && item.value < 0) issues.push({ severity: 'error', metric: item.metric, message: 'Throughput and quota values cannot be negative' })
    if (/slaPercent|availabilityPercent/i.test(item.metric) && (item.value < 0 || item.value > 100)) issues.push({ severity: 'error', metric: item.metric, message: 'Availability must be between 0 and 100' })
  }
  if (item.effectiveDate && !Number.isFinite(Date.parse(item.effectiveDate))) issues.push({ severity: 'error', metric: item.metric, message: 'Effective date is invalid' })
  if (item.expiresAt && !Number.isFinite(Date.parse(item.expiresAt))) issues.push({ severity: 'error', metric: item.metric, message: 'Expiry date is invalid' })
  return issues
}

export function validateEvidenceSet(items: Evidence[], now = new Date()) {
  return items.flatMap(item => validateEvidence(item, now))
}