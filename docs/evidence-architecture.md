# Evidence Architecture

## Principles

- External systems provide facts, never final architecture or model scores.
- Recommendation scoring is synchronous and deterministic after catalog hydration.
- Internet collectors and Azure AI Search credentials remain server-side.
- Failed refreshes preserve the last-known-good facts.
- Seed facts are labeled `expert-rule` and use `urn:decision-catalog:baseline:*` provenance.

## Lifecycle

1. `scripts/refreshEvidence.ts` runs configured provider and official-document collectors.
2. Provider records are normalized to the canonical `Evidence` contract.
3. `validateEvidenceSet` rejects malformed values, dates, confidence, and provenance. Stale evidence produces warnings.
4. A valid snapshot is written atomically to `server/catalog/decision-catalog.json`.
5. When configured, the same facts are indexed in Azure AI Search.
6. The app loads the snapshot, derives runtime metrics, validates all derived evidence, and hydrates the deterministic engine.
7. `/api/recommendations` retrieves fresh, scoped Search evidence, validates it, and supplies it to the deterministic engine.
8. `/api/evidence/search` exposes read-only scoped retrieval for inspection without exposing credentials.

## Failure Behavior

Collector failures are recorded in `collectedEvidence.failures`. Existing facts are retained for failed queries. A refresh cannot replace the catalog when no last-known-good pricing exists or evidence validation reports errors. Search being unavailable leaves recommendation metrics unavailable unless another authoritative evidence source was supplied; it never authorizes a catalog baseline as a replacement.

## Canonical Evidence

Each record includes metric, value, unit, source type, source name, source URL, retrieval time, optional validity dates, and confidence. Architecture/model scope may additionally include provider, dimension, architecture ID, or model ID.
