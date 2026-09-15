import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { collectAwsPricing } from '../server/evidence/awsPricingCollector.js'
import { collectAzurePricing } from '../server/evidence/azurePricingCollector.js'
import { collectGooglePricing } from '../server/evidence/googlePricingCollector.js'
import { indexEvidence } from '../server/evidence/azureSearchEvidenceSink.js'
import { normalizePricingFact } from '../server/evidence/normalizer.js'
import { collectOfficialDocumentEvidence, type OfficialDocumentQuery } from '../server/evidence/officialDocumentCollector.js'
import type { CollectedEvidence, PricingFact, PricingQuery } from '../server/evidence/types.js'
import { validateEvidenceSet } from '../src/evidence/validation.js'

type RefreshCatalog = {
  catalogVersion: string
  collection: { pricingQueries: PricingQuery[] }
  collectedEvidence?: CollectedEvidence
}

const catalogPath = resolve('server/catalog/decision-catalog.json')
const temporaryPath = `${catalogPath}.tmp`
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as RefreshCatalog
const providerFilter = process.env.EVIDENCE_PROVIDER
const queries = catalog.collection.pricingQueries.filter(query => !providerFilter || query.provider === providerFilter)
const collectors = { Azure: collectAzurePricing, AWS: collectAwsPricing, 'Google Cloud': collectGooglePricing } as const
const previous = catalog.collectedEvidence?.pricing ?? []
const previousDocuments = catalog.collectedEvidence?.documents ?? []
const nextFacts: PricingFact[] = [...previous]
const failures: CollectedEvidence['failures'] = []
const documentQueries = ((catalog.collection as { officialDocumentQueries?: OfficialDocumentQuery[] }).officialDocumentQueries ?? [])

for (const query of queries) {
  try {
    const current = await collectors[query.provider](query)
    if (!current.length) throw new Error('Provider returned no matching prices')
    const retained = nextFacts.filter(fact => !fact.id.startsWith(`${query.id}:`))
    nextFacts.splice(0, nextFacts.length, ...retained, ...current)
  } catch (error) {
    failures.push({ queryId: query.id, message: error instanceof Error ? error.message : 'Unknown collection failure' })
  }
}

const documents = [...previousDocuments]
for (const query of documentQueries) {
  try {
    const current = await collectOfficialDocumentEvidence(query)
    const retained = documents.filter(item => !(item.metric === query.metric && item.sourceName === query.sourceName))
    documents.splice(0, documents.length, ...retained, current)
  } catch (error) {
    failures.push({ queryId: query.id, message: error instanceof Error ? error.message : 'Unknown document collection failure' })
  }
}

if (!nextFacts.length && failures.length) throw new Error(`No last-known-good pricing exists; refresh failed: ${failures.map(item => `${item.queryId}: ${item.message}`).join('; ')}`)
const normalizedEvidence = [...nextFacts.map(normalizePricingFact), ...documents]
const validationIssues = validateEvidenceSet(normalizedEvidence)
const validationErrors = validationIssues.filter(issue => issue.severity === 'error')
if (validationErrors.length) throw new Error(`Evidence validation failed: ${validationErrors.map(issue => `${issue.metric}: ${issue.message}`).join('; ')}`)
const validationWarnings = validationIssues.filter(issue => issue.severity === 'warning')
catalog.collectedEvidence = { schemaVersion: '1.0', collectedAt: new Date().toISOString(), pricing: nextFacts, documents, failures }
await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`)
await rename(temporaryPath, catalogPath)
const search = await indexEvidence(normalizedEvidence)
console.log(JSON.stringify({ queries: queries.length, prices: nextFacts.length, failures, validationWarnings, search }, null, 2))