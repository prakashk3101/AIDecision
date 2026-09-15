import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectAzurePricing } from './azurePricingCollector.js'
import { collectGooglePricing } from './googlePricingCollector.js'
import { normalizePricingFact } from './normalizer.js'

afterEach(() => vi.unstubAllGlobals())

describe('pricing evidence collectors', () => {
  it('normalizes Azure Retail Prices records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      Items: [{ serviceName: 'Azure OpenAI', productName: 'Model Inference', skuName: 'Global', armRegionName: 'eastus', unitOfMeasure: '1M tokens', retailPrice: .75, currencyCode: 'USD', effectiveStartDate: '2026-08-01', meterId: 'meter-1' }],
    }), { status: 200 })))

    const facts = await collectAzurePricing({ id: 'azure-openai', provider: 'Azure', service: 'Azure OpenAI', region: 'eastus', sku: 'configured-sku', resourceCategory: 'ai', targetUnit: 'inference-request', unitScale: 1, conversionNote: 'test' })
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ provider: 'Azure', unitPrice: .75, rawReference: 'meter-1', resourceCategory: 'ai', targetUnit: 'inference-request' })
    expect(normalizePricingFact(facts[0])).toMatchObject({ metric: 'pricing.unitPrice', sourceType: 'official-api', confidence: 95, unit: 'USD/inference-request' })
  })

  it('resolves Google services and filters regional SKU prices', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ services: [{ name: 'services/vertex', displayName: 'Vertex AI' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ skus: [{
        name: 'services/vertex/skus/sku-1', skuId: 'sku-1', description: 'Gemini inference', serviceRegions: ['us-east1'],
        pricingInfo: [{ effectiveTime: '2026-08-01', pricingExpression: { usageUnit: '1M tokens', tieredRates: [{ unitPrice: { units: '1', nanos: 250_000_000 } }] } }],
      }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const facts = await collectGooglePricing({ id: 'vertex', provider: 'Google Cloud', service: 'Vertex AI', region: 'us-east1', sku: 'sku-1', resourceCategory: 'ai', targetUnit: 'inference-request', unitScale: 1, conversionNote: 'test' })
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ provider: 'Google Cloud', sku: 'sku-1', unitPrice: 1.25 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})