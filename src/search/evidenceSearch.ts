import type { EvidenceSearchQuery, EvidenceSearchResult } from './searchTypes'

export async function retrieveEvidence(query: EvidenceSearchQuery): Promise<EvidenceSearchResult> {
  const parameters = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') parameters.set(key, String(value))
  })
  const response = await fetch(`/api/evidence/search?${parameters}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Evidence search returned ${response.status}`)
  return response.json() as Promise<EvidenceSearchResult>
}