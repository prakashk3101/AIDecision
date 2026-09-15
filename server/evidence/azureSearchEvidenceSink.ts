import { DefaultAzureCredential } from '@azure/identity'
import { SearchClient } from '@azure/search-documents'
import { createHash } from 'node:crypto'
import type { Evidence } from '../../src/catalog/modelCatalog.js'
import type { SearchEvidenceDocument } from '../../src/search/searchTypes.js'

export async function indexEvidence(evidence: Array<Evidence & Partial<SearchEvidenceDocument>>) {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT
  const indexName = process.env.AZURE_SEARCH_EVIDENCE_INDEX
  if (!endpoint || !indexName || !evidence.length) return { indexed: 0, skipped: true }

  const client = new SearchClient<SearchEvidenceDocument>(endpoint, indexName, new DefaultAzureCredential())
  const documents = evidence.map(item => ({
    ...item,
    id: createHash('sha256').update(`${item.metric}|${item.sourceUrl}|${item.value}|${item.retrievedAt}`).digest('base64url'),
  }))
  const result = await client.uploadDocuments(documents)
  const failures = result.results.filter(item => !item.succeeded)
  if (failures.length) throw new Error(`Azure AI Search rejected ${failures.length} evidence documents`)
  return { indexed: documents.length, skipped: false }
}