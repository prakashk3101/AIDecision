import { describe, expect, it } from 'vitest'
import { buildEvidenceFilter } from './azureAiSearchEvidenceStore.js'

describe('Azure AI Search evidence filters', () => {
  it('escapes values and composes scope and freshness filters', () => {
    expect(buildEvidenceFilter({ provider: "Provider's Cloud", architectureId: 'rag', sourceType: 'official-api', freshAfter: '2026-01-01' })).toBe(
      "provider eq 'Provider''s Cloud' and architectureId eq 'rag' and sourceType eq 'official-api' and retrievedAt ge 2026-01-01T00:00:00.000Z",
    )
  })
})