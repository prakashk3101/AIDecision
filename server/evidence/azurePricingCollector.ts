import type { PricingFact, PricingQuery } from './types.js'

type AzurePriceItem = {
  serviceName?: string
  productName?: string
  skuName?: string
  meterName?: string
  armRegionName?: string
  unitOfMeasure?: string
  retailPrice?: number
  currencyCode?: string
  effectiveStartDate?: string
  meterId?: string
}

type AzurePriceResponse = { Items?: AzurePriceItem[]; NextPageLink?: string }

const quote = (value: string) => value.replaceAll("'", "''")

export async function collectAzurePricing(query: PricingQuery): Promise<PricingFact[]> {
  const clauses = [`serviceName eq '${quote(query.service)}'`, `armRegionName eq '${quote(query.region)}'`, "priceType eq 'Consumption'"]
  if (query.sku) clauses.push(`skuName eq '${quote(query.sku)}'`)
  if (query.product) clauses.push(`productName eq '${quote(query.product)}'`)
  if (query.meterName) clauses.push(`meterName eq '${quote(query.meterName)}'`)
  let url: string | undefined = `https://prices.azure.com/api/retail/prices?currencyCode='USD'&$filter=${encodeURIComponent(clauses.join(' and '))}`
  const facts: PricingFact[] = []

  while (url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Azure Retail Prices returned ${response.status}`)
    const page = await response.json() as AzurePriceResponse
    for (const item of page.Items ?? []) {
      if (!Number.isFinite(item.retailPrice)) continue
      if (item.retailPrice === 0) continue
      facts.push({
        id: `${query.id}:${item.meterId ?? facts.length}`,
        provider: 'Azure', service: item.serviceName ?? query.service, product: item.productName ?? '', sku: item.skuName ?? '',
        region: item.armRegionName ?? query.region, unit: query.targetUnit, unitPrice: item.retailPrice! / query.unitScale,
        currency: item.currencyCode ?? 'USD', effectiveFrom: item.effectiveStartDate,
        resourceCategory: query.resourceCategory, targetUnit: query.targetUnit,
        providerUnit: item.unitOfMeasure ?? '', unitScale: query.unitScale,
        sourceUrl: 'https://prices.azure.com/api/retail/prices', retrievedAt: new Date().toISOString(),
        rawReference: item.meterId ?? query.id,
      })
    }
    url = page.NextPageLink
  }
  return facts
}