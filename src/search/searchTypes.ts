import type { Evidence, EvidenceDimension, EvidenceType } from '../catalog/modelCatalog.js'

export type EvidenceScope = {
  provider?: string
  dimension?: EvidenceDimension
  architectureId?: string
  modelId?: string
}

export type SearchEvidenceDocument = Evidence & EvidenceScope

export type EvidenceSearchQuery = EvidenceScope & {
  text?: string
  sourceType?: EvidenceType
  freshAfter?: string
  limit?: number
}

export type EvidenceSearchResult = {
  evidence: SearchEvidenceDocument[]
  total: number
  source: 'azure-ai-search' | 'catalog'
}