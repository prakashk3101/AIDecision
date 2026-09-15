# Azure AI Search

## Role

Azure AI Search stores validated evidence facts for retrieval at recommendation time. It does not calculate scores, choose architectures, or store a winner. The deterministic engine remains authoritative.

The repository does not demonstrate that an Azure AI Search index has been created or populated. When Search settings are absent, retrieval returns an empty result; missing evidence remains missing.

## Configuration

Set these server-side environment variables:

- `AZURE_SEARCH_ENDPOINT`
- `AZURE_SEARCH_EVIDENCE_INDEX`
- `EVIDENCE_MAX_AGE_DAYS` (optional, default `90`)

Authentication uses `DefaultAzureCredential`. Grant the recommendation runtime Search Index Data Reader. Grant a refresh identity Search Index Data Contributor only when it uploads evidence. Do not expose keys or credentials to React.

## Documents And Scope

The required field definition is in `docs/azure-ai-search-index.md`. Evidence should include `architectureId` and, when provider-specific, `provider`. Model facts should include `modelId`.

`POST /api/recommendations` queries each architecture with an architecture filter, optional selected-provider filter, freshness boundary, and a maximum of 100 records. Results are validated before use. Out-of-scope architecture or provider records fail the request, and the deterministic boundary independently filters mismatched scope.

## Refresh

`npm run catalog:refresh` collects and validates configured official facts. When Search is configured, the refresh sink uploads normalized documents. Collector failures remain visible in the catalog failure list and do not authorize fabricated replacements.

Recommended production scheduling should run pricing more frequently than slow-changing SLA and capability documents, retry transient provider failures with bounded backoff, and preserve the last-known-good version. Scheduling infrastructure is environment-specific and is not provisioned by this repository.

## Verification

Use `GET /api/evidence/search?architectureId=<id>&provider=<provider>` to inspect retrieval. Verify document count, scope, source URL, retrieval timestamp, confidence, and units before relying on a recommendation. An HTTP success with zero documents means no evidence was retrieved, not that the architecture passed evidence gates.