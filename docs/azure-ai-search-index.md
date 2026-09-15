# Azure AI Search Evidence Index

## Purpose

The index stores validated evidence facts for recommendation-time orchestration and user inspection. It must not store final architecture scores, rankings, or winners.

## Required Fields

| Field | Type | Attributes |
| --- | --- | --- |
| `id` | `Edm.String` | key, filterable |
| `metric` | `Edm.String` | searchable, filterable |
| `value` | `Edm.String` | searchable |
| `unit` | `Edm.String` | filterable |
| `sourceType` | `Edm.String` | filterable, facetable |
| `sourceName` | `Edm.String` | searchable, filterable |
| `sourceUrl` | `Edm.String` | retrievable |
| `retrievedAt` | `Edm.DateTimeOffset` | filterable, sortable |
| `validFrom` | `Edm.DateTimeOffset` | filterable |
| `validUntil` | `Edm.DateTimeOffset` | filterable |
| `confidence` | `Edm.Double` | filterable, sortable |
| `provider` | `Edm.String` | filterable, facetable |
| `dimension` | `Edm.String` | filterable, facetable |
| `architectureId` | `Edm.String` | filterable |
| `modelId` | `Edm.String` | filterable |

Because canonical evidence values can be numeric or textual, deployments may represent `value` as a string and add an optional `numericValue: Edm.Double` for numeric range queries.

## Query API

`GET /api/evidence/search` accepts `text`, `provider`, `dimension`, `architectureId`, `modelId`, `sourceType`, `freshAfter`, and `limit`. Filters are assembled from allowlisted fields and quote-escaped server-side. Requests without Search configuration return an empty catalog fallback result.

## Security

Use `DefaultAzureCredential` and grant the runtime identity only Search Index Data Reader for retrieval and Search Index Data Contributor for refresh/indexing. Never expose endpoint credentials or admin keys to React. Use private networking and managed identity in production where available.

## Freshness

Use `freshAfter` for recommendation-time filtering. Empty-text retrieval sorts newest first. Catalog hydration and refresh validation remain authoritative guards; Search results do not bypass evidence validation or deterministic scoring.
