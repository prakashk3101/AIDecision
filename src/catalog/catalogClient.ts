import { hydrateArchitectureCatalog } from './architectureCatalog.js'
import { hydrateModelCatalog, type ModelScoringWeights } from './modelCatalog.js'
import { hydrateTechnologyCatalog, type PlatformCatalog } from './technologyCatalog.js'
import { hydrateDefaultWeights, type ScoreWeights } from '../scoring/weights.js'
import { hydrateScoringConfig, type RuntimeScoringConfig } from '../scoring/config.js'
import { deriveArchitecture, deriveModel, type RawArchitectureEntry, type RawModelEntry } from './catalogDerivation.js'
import { validateEvidenceSet } from '../evidence/validation.js'
import type { Evidence } from './modelCatalog.js'

export type CollectedPricingEvidence = { pricing?: Array<Record<string, unknown>> }

export type DecisionCatalog = {
  catalogVersion: string
  lastUpdated: string
  scoring: RuntimeScoringConfig & {
    defaultWeights: ScoreWeights
    modelWeights: ModelScoringWeights
  }
  architectures: RawArchitectureEntry[]
  models: RawModelEntry[]
  platforms: PlatformCatalog
  collectedEvidence?: { pricing?: PricingFactLike[] }
}

// Mirrors server/evidence PricingFact without importing server code into the browser bundle.
type PricingFactLike = {
  id: string
  provider: string
  service: string
  product?: string
  sku?: string
  region?: string
  unitPrice: number
  currency: string
  resourceCategory: string
  targetUnit: string
  sourceUrl: string
  retrievedAt: string
  effectiveFrom?: string
}

function collectedPricingEvidence(catalog: DecisionCatalog): Evidence[] {
  return (catalog.collectedEvidence?.pricing ?? [])
    .filter(fact => Number.isFinite(fact.unitPrice) && typeof fact.resourceCategory === 'string' && typeof fact.targetUnit === 'string')
    .map(fact => ({
      id: fact.id, provider: fact.provider, service: fact.service, dimension: 'cost' as const,
      metric: 'pricing.unitPrice', value: fact.unitPrice, unit: `${fact.currency}/${fact.targetUnit}`,
      sourceType: 'official-api' as const, sourceName: `${fact.provider} public pricing catalog`, sourceUrl: fact.sourceUrl,
      retrievedAt: fact.retrievedAt, effectiveDate: fact.effectiveFrom, confidence: 95,
      metadata: { product: fact.product, sku: fact.sku, region: fact.region, resourceCategory: fact.resourceCategory },
    }))
}

function isDecisionCatalog(value: unknown): value is DecisionCatalog {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<DecisionCatalog>
  return typeof response.catalogVersion === 'string'
    && typeof response.lastUpdated === 'string'
    && Array.isArray(response.architectures)
    && response.architectures.every(item => Boolean(item)
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && ['active', 'deprecated', 'experimental'].includes(item.metadata?.status)
      && Array.isArray(item.observations?.pricing?.components)
      && item.observations.pricing.components.every(component => Number.isFinite(component.unitPrice) && Number.isFinite(component.monthlyQuantity) && typeof component.sourceUrl === 'string')
      && Array.isArray(item.observations?.benchmark?.latencyFormula?.components)
      && item.observations.benchmark.latencyFormula.components.every(component => typeof component.name === 'string' && Number.isFinite(component.p95Ms))
      && Number.isFinite(item.observations.benchmark.latencyFormula.modelMultiplier)
      && Number.isFinite(item.observations?.capacity?.testedRequestsPerSecond)
      && Number.isFinite(item.observations?.availability?.slaPercent))
    && Array.isArray(response.models)
    && response.models.every(model => typeof model?.id === 'string'
      && Number.isFinite(model.pricing?.inputPer1M)
      && Number.isFinite(model.pricing?.outputPer1M)
      && Number.isFinite(model.capabilities?.contextWindow)
      && Array.isArray(model.observations?.qualityBenchmarks)
      && model.observations.qualityBenchmarks.length > 0
      && Number.isFinite(model.observations?.latency?.ttftMs)
      && Number.isFinite(model.observations?.latency?.outputTokensPerSecond))
    && Boolean(response.platforms && typeof response.platforms === 'object' && Object.keys(response.platforms).length)
    && Boolean(response.scoring?.defaultWeights && Object.keys(response.scoring.defaultWeights).length)
    && Boolean(response.scoring?.modelWeights && Object.values(response.scoring.modelWeights).every(Number.isFinite))
    && Boolean(response.scoring?.microservicesFit?.keywords?.length)
    && Boolean(response.scoring?.derivation?.complexity && response.scoring?.derivation?.model)
}

export function hydrateDecisionCatalog(catalog: DecisionCatalog) {
  hydrateScoringConfig(catalog.scoring)
  const pricing = collectedPricingEvidence(catalog)
  const architectures = catalog.architectures.map(deriveArchitecture).map(entry => ({ ...entry, evidence: [...entry.evidence, ...pricing] }))
  const models = catalog.models.map(deriveModel)
  const issues = validateEvidenceSet([
    ...architectures.flatMap(item => item.evidence),
    ...models.flatMap(item => item.evidence),
  ])
  const errors = issues.filter(issue => issue.severity === 'error')
  if (errors.length) throw new Error(`Decision catalog evidence is invalid: ${errors.map(issue => `${issue.metric}: ${issue.message}`).join('; ')}`)
  const warnings = issues.filter(issue => issue.severity === 'warning')
  if (warnings.length) console.warn('Decision catalog evidence warnings', warnings)
  hydrateArchitectureCatalog(architectures)
  hydrateModelCatalog(models, catalog.scoring.modelWeights)
  hydrateTechnologyCatalog(catalog.platforms, catalog.lastUpdated.slice(0, 10))
  hydrateDefaultWeights(catalog.scoring.defaultWeights)
  return architectures
}

export async function loadArchitectureCatalog() {
  const response = await fetch('/api/catalog/architectures', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Architecture catalog returned ${response.status}`)
  const payload: unknown = await response.json()
  if (!isDecisionCatalog(payload)) throw new Error('Decision catalog returned an invalid response')
  return hydrateDecisionCatalog(payload)
}