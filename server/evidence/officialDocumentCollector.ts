import { lookup } from 'node:dns/promises'
import ipaddr from 'ipaddr.js'
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

const isPublicAddress = (address: string) => {
  if (!ipaddr.isValid(address)) return false
  const parsed = ipaddr.parse(address)
  const normalized = parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    ? (parsed as ipaddr.IPv6).toIPv4Address()
    : parsed
  return normalized.range() === 'unicast'
}

export function validateOfficialSourceUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Official source must use standard HTTPS without embedded credentials')
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || (ipaddr.isValid(hostname) && !isPublicAddress(hostname))) {
    throw new Error('Official source must not target a local or private address')
  }
  return url
}

async function assertPublicDestination(url: URL) {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(result => !isPublicAddress(result.address))) {
    throw new Error('Official source resolved to a local or private address')
  }
}

async function fetchOfficialSource(sourceUrl: string) {
  let url = validateOfficialSourceUrl(sourceUrl)
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublicDestination(url)
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'text/html,application/json' }, redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location) throw new Error('Official source redirect did not include a location')
    url = validateOfficialSourceUrl(new URL(location, url).toString())
  }
  throw new Error('Official source exceeded the redirect limit')
}

export async function collectOfficialDocumentEvidence(query: OfficialDocumentQuery): Promise<Evidence> {
  const response = await fetchOfficialSource(query.sourceUrl)
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