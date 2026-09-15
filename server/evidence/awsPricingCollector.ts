import { GetProductsCommand, PricingClient, type Filter } from '@aws-sdk/client-pricing'
import type { PricingFact, PricingQuery } from './types.js'

type AwsProduct = {
  product?: { sku?: string; attributes?: Record<string, string> }
  terms?: { OnDemand?: Record<string, { effectiveDate?: string; priceDimensions?: Record<string, { unit?: string; pricePerUnit?: Record<string, string> }> }> }
}

export async function collectAwsPricing(query: PricingQuery): Promise<PricingFact[]> {
  const client = new PricingClient({ region: process.env.AWS_PRICING_REGION ?? 'us-east-1' })
  const filters: Filter[] = [{ Type: 'TERM_MATCH', Field: 'location', Value: query.region }]
  if (query.sku) filters.push({ Type: 'TERM_MATCH', Field: 'instanceType', Value: query.sku })
  if (query.product) filters.push({ Type: 'TERM_MATCH', Field: 'productFamily', Value: query.product })
  const facts: PricingFact[] = []
  let nextToken: string | undefined

  do {
    const page = await client.send(new GetProductsCommand({ ServiceCode: query.service, Filters: filters, NextToken: nextToken, MaxResults: 100 }))
    for (const encoded of page.PriceList ?? []) {
      const item = JSON.parse(encoded) as AwsProduct
      const attributes = item.product?.attributes ?? {}
      for (const term of Object.values(item.terms?.OnDemand ?? {})) {
        for (const dimension of Object.values(term.priceDimensions ?? {})) {
          const price = Number(dimension.pricePerUnit?.USD)
          if (!Number.isFinite(price)) continue
          facts.push({
            id: `${query.id}:${item.product?.sku ?? facts.length}`, provider: 'AWS', service: query.service,
            product: attributes.productFamily ?? query.product ?? '', sku: item.product?.sku ?? query.sku ?? '', region: query.region,
            unit: query.targetUnit, unitPrice: price / query.unitScale, currency: 'USD', effectiveFrom: term.effectiveDate,
            resourceCategory: query.resourceCategory, targetUnit: query.targetUnit,
            providerUnit: dimension.unit ?? '', unitScale: query.unitScale,
            sourceUrl: 'https://pricing.us-east-1.amazonaws.com', retrievedAt: new Date().toISOString(),
            rawReference: item.product?.sku ?? query.id,
          })
        }
      }
    }
    nextToken = page.NextToken
  } while (nextToken)

  return facts
}