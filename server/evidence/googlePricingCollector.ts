import type { PricingFact, PricingQuery } from './types.js'

type GoogleService = { name?: string; displayName?: string }
type GoogleMoney = { units?: string; nanos?: number }
type GoogleSku = {
  name?: string
  skuId?: string
  description?: string
  serviceRegions?: string[]
  pricingInfo?: Array<{ effectiveTime?: string; pricingExpression?: { usageUnit?: string; tieredRates?: Array<{ unitPrice?: GoogleMoney }> } }>
}

const authHeaders = () => process.env.GOOGLE_CLOUD_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.GOOGLE_CLOUD_ACCESS_TOKEN}` } : {}
const withKey = (url: string) => process.env.GOOGLE_CLOUD_API_KEY ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(process.env.GOOGLE_CLOUD_API_KEY)}` : url

export async function collectGooglePricing(query: PricingQuery): Promise<PricingFact[]> {
  const servicesResponse = await fetch(withKey('https://cloudbilling.googleapis.com/v1/services'), { headers: { Accept: 'application/json', ...authHeaders() }, signal: AbortSignal.timeout(30_000) })
  if (!servicesResponse.ok) throw new Error(`Google Cloud Billing services returned ${servicesResponse.status}`)
  const services = await servicesResponse.json() as { services?: GoogleService[] }
  const service = services.services?.find(item => item.name === query.service || item.displayName === query.service)
  if (!service?.name) throw new Error(`Google Cloud service not found: ${query.service}`)

  const facts: PricingFact[] = []
  let pageToken = ''
  do {
    const pageUrl = withKey(`https://cloudbilling.googleapis.com/v1/${service.name}/skus?pageSize=5000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
    const response = await fetch(pageUrl, { headers: { Accept: 'application/json', ...authHeaders() }, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Google Cloud Billing SKUs returned ${response.status}`)
    const page = await response.json() as { skus?: GoogleSku[]; nextPageToken?: string }
    for (const sku of page.skus ?? []) {
      if (query.sku && sku.skuId !== query.sku) continue
      if (query.product && !sku.description?.toLowerCase().includes(query.product.toLowerCase())) continue
      if (sku.serviceRegions?.length && !sku.serviceRegions.includes(query.region) && !sku.serviceRegions.includes('global')) continue
      const pricing = sku.pricingInfo?.at(-1)
      const money = pricing?.pricingExpression?.tieredRates?.[0]?.unitPrice
      const unitPrice = Number(money?.units ?? 0) + Number(money?.nanos ?? 0) / 1_000_000_000
      facts.push({
        id: `${query.id}:${sku.skuId ?? facts.length}`, provider: 'Google Cloud', service: service.displayName ?? query.service,
        product: sku.description ?? '', sku: sku.skuId ?? '', region: query.region,
        unit: query.targetUnit, unitPrice: unitPrice / query.unitScale, currency: 'USD', effectiveFrom: pricing?.effectiveTime,
        resourceCategory: query.resourceCategory, targetUnit: query.targetUnit,
        providerUnit: pricing?.pricingExpression?.usageUnit ?? '', unitScale: query.unitScale,
        sourceUrl: 'https://cloudbilling.googleapis.com/v1/services', retrievedAt: new Date().toISOString(),
        rawReference: sku.name ?? sku.skuId ?? query.id,
      })
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return facts
}