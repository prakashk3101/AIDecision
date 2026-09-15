import type { Evidence } from '../../src/catalog/modelCatalog.js'

export type OfficialDocumentQuery = {
  id: string
  provider?: string
  service?: string
  architectureId?: string
  modelId?: string
  dimension?: Evidence['dimension']
  metric: string
  value: string | number
  unit?: string
  sourceType: 'official-documentation' | 'official-sla'
  sourceName: string
  sourceUrl: string
}

export async function collectOfficialDocumentEvidence(query: OfficialDocumentQuery): Promise<Evidence> {
  if (!query.sourceUrl.startsWith('https://')) throw new Error(`${query.id} must reference an HTTPS official source`)
  const response = await fetch(query.sourceUrl, { method: 'GET', headers: { Accept: 'text/html,application/json' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${query.sourceName} returned ${response.status}`)
  await response.body?.cancel()
  return {
    id: query.id, provider: query.provider, service: query.service, architectureId: query.architectureId, modelId: query.modelId,
    dimension: query.dimension ?? (query.metric.startsWith('availability') ? 'availability' : 'security'),
    metric: query.metric, value: query.value, unit: query.unit, sourceType: query.sourceType,
    sourceName: query.sourceName, sourceUrl: response.url || query.sourceUrl,
    retrievedAt: new Date().toISOString(), confidence: query.sourceType === 'official-sla' ? 95 : 90,
  }
}