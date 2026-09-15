import type { Evidence } from '../../src/catalog/modelCatalog.js'
import type { ResourceCategory } from '../../src/resource/resourceEstimator.js'

export type Provider = 'Azure' | 'AWS' | 'Google Cloud'

export type PricingFact = {
  id: string
  provider: Provider
  service: string
  product: string
  sku: string
  region: string
  unit: string
  unitPrice: number
  currency: string
  resourceCategory: ResourceCategory
  targetUnit: string
  providerUnit: string
  unitScale: number
  effectiveFrom?: string
  sourceUrl: string
  retrievedAt: string
  rawReference: string
}

export type PricingQuery = {
  id: string
  provider: Provider
  service: string
  region: string
  sku: string
  product?: string
  meterName?: string
  resourceCategory: ResourceCategory
  targetUnit: string
  // Provider units are billed in bundles (for example "1M" requests); price is divided by this.
  unitScale: number
  conversionNote: string
}

export type CollectedEvidence = {
  schemaVersion: '1.0'
  collectedAt: string
  pricing: PricingFact[]
  documents: Evidence[]
  failures: Array<{ queryId: string; message: string }>
}