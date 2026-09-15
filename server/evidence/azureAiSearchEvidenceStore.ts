import { DefaultAzureCredential } from '@azure/identity'
import { SearchClient } from '@azure/search-documents'
import type { EvidenceSearchQuery, EvidenceSearchResult, SearchEvidenceDocument } from '../../src/search/searchTypes.js'

const escapeFilterValue = (value: string) => value.replaceAll("'", "''")

export function buildEvidenceFilter(query: EvidenceSearchQuery) {
  const equals = (field: string, value?: string) => value ? `${field} eq '${escapeFilterValue(value)}'` : undefined
  return [
    equals('provider', query.provider), equals('dimension', query.dimension), equals('architectureId', query.architectureId),
    equals('modelId', query.modelId), equals('sourceType', query.sourceType),
    query.freshAfter ? `retrievedAt ge ${new Date(query.freshAfter).toISOString()}` : undefined,
  ].filter(Boolean).join(' and ') || undefined
}

export async function searchEvidence(query: EvidenceSearchQuery): Promise<EvidenceSearchResult> {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT
  const indexName = process.env.AZURE_SEARCH_EVIDENCE_INDEX
  if (!endpoint || !indexName) return { evidence: [], total: 0, source: 'catalog' }
  const client = new SearchClient<SearchEvidenceDocument>(endpoint, indexName, new DefaultAzureCredential())
  const limit = Math.max(1, Math.min(100, query.limit ?? 25))
  const response = await client.search(query.text?.trim() || '*', {
    filter: buildEvidenceFilter(query),
    top: limit,
    includeTotalCount: true,
    orderBy: query.text?.trim() ? undefined : ['retrievedAt desc'],
  })
  const evidence: SearchEvidenceDocument[] = []
  for await (const result of response.results) evidence.push(result.document)
  return { evidence, total: response.count ?? evidence.length, source: 'azure-ai-search' }
}