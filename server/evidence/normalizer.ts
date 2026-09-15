import type { Evidence } from '../../src/catalog/modelCatalog.js'
import type { PricingFact } from './types.js'

export function normalizePricingFact(fact: PricingFact): Evidence {
  return {
    id: fact.id, provider: fact.provider, service: fact.service, dimension: 'cost',
    metric: 'pricing.unitPrice', value: fact.unitPrice, unit: `${fact.currency}/${fact.targetUnit}`,
    sourceType: 'official-api', sourceName: `${fact.provider} public pricing catalog`, sourceUrl: fact.sourceUrl,
    retrievedAt: fact.retrievedAt, effectiveDate: fact.effectiveFrom, confidence: 95,
    metadata: { product: fact.product, sku: fact.sku, region: fact.region, rawReference: fact.rawReference, resourceCategory: fact.resourceCategory, providerUnit: fact.providerUnit, unitScale: fact.unitScale },
  }
}