import { describe, expect, it } from 'vitest'
import source from '../../server/catalog/decision-catalog.json'
import { architectureCatalog } from './architectureCatalog'
import { modelCatalog, modelScoringWeights } from './modelCatalog'
import { platformCatalog } from './technologyCatalog'
import { defaultWeights } from '../scoring/weights'
import { scoringConfig } from '../scoring/config'
import { hydrateTestCatalog } from '../testCatalog'
import { deriveArchitecture, deriveModel } from './catalogDerivation'
import type { DecisionCatalog } from './catalogClient'

hydrateTestCatalog()
const catalog = source as unknown as DecisionCatalog

describe('unified decision catalog', () => {
  it('hydrates every curated runtime store from one JSON source', () => {
    const pricingIds = new Set((catalog.collectedEvidence?.pricing ?? []).map(fact => fact.id))
    const derived = catalog.architectures.map(deriveArchitecture)
    expect(architectureCatalog.map(entry => ({ ...entry, evidence: entry.evidence.filter(item => !pricingIds.has(item.id)) }))).toEqual(derived)
    expect(modelCatalog).toEqual(catalog.models.map(deriveModel))
    expect(platformCatalog).toEqual(source.platforms)
    expect(defaultWeights).toEqual(source.scoring.defaultWeights)
    expect(modelScoringWeights).toEqual(source.scoring.modelWeights)
    expect(scoringConfig.microservicesFit).toEqual(source.scoring.microservicesFit)
  })

  it('attaches collected official pricing to every architecture', () => {
    const pricing = architectureCatalog[0].evidence.filter(item => item.sourceType === 'official-api' && item.metric === 'pricing.unitPrice')
    expect(pricing.length).toBeGreaterThan(0)
    expect(pricing.every(item => typeof item.metadata?.resourceCategory === 'string')).toBe(true)
  })
})