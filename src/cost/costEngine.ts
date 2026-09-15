import type { Evidence } from '../catalog/modelCatalog.js'
import type { ResourceCategory, ResourceRequirements } from '../resource/resourceEstimator.js'

export type CostEstimate = {
  available: boolean
  low: number
  expected: number
  high: number
  breakdown: Record<string, number>
  assumptions: string[]
  evidence: Evidence[]
  evidenceIds: string[]
  currency: string
  missingCategories: ResourceCategory[]
}

const categories: ResourceCategory[] = ['compute', 'database', 'storage', 'networking', 'messaging', 'search', 'ai', 'monitoring', 'security']
const categoryLabel = (category: ResourceCategory) => category[0].toUpperCase() + category.slice(1)

function matchingPrice(evidence: Evidence[], provider: string, category: ResourceCategory, unit: string) {
  return evidence.find(item => item.dimension === 'cost'
    && item.sourceType === 'official-api'
    && item.provider === provider
    && item.metadata?.resourceCategory === category
    && item.unit?.endsWith(`/${unit}`)
    && typeof item.value === 'number')
}

export type ModelCostInput = { monthlyCost: number; evidence: Evidence[]; assumption: string }

function rangeFor(value: number) {
  return { low: value * 0.8, high: value * 1.25 }
}

function modelRange(value: number) {
  return { low: value * 0.75, high: value * 1.35 }
}

export function calculateArchitectureCost(requirements: ResourceRequirements, evidence: Evidence[], model?: ModelCostInput): CostEstimate {
  const provider = requirements.provider ?? ''
  const matches = requirements.resources.map(resource => ({ resource, price: matchingPrice(evidence, provider, resource.category, resource.unit) }))
  const missingCategories = matches.filter(item => !item.price).map(item => item.resource.category)
  const matchedEvidence = matches.flatMap(item => item.price ? [item.price] : [])
  if (missingCategories.length) return {
    available: false, low: Number.POSITIVE_INFINITY, expected: Number.POSITIVE_INFINITY, high: Number.POSITIVE_INFINITY,
    breakdown: {}, assumptions: [...requirements.assumptions, `Missing official prices for: ${missingCategories.join(', ')}`],
    evidence: matchedEvidence, evidenceIds: matchedEvidence.map(item => item.id), currency: 'USD', missingCategories,
  }
  const breakdown = Object.fromEntries(categories.map(category => [categoryLabel(category), 0])) as Record<string, number>
  let low = 0
  let high = 0
  for (const { resource, price } of matches) {
    const value = resource.quantity * Number(price!.value)
    const range = rangeFor(value)
    breakdown[categoryLabel(resource.category)] += value
    low += range.low
    high += range.high
  }
  if (model) breakdown[categoryLabel('ai')] += model.monthlyCost
  if (model) {
    const range = modelRange(model.monthlyCost)
    low += range.low
    high += range.high
  }
  const combinedEvidence = [...matchedEvidence, ...(model?.evidence ?? [])]
  const expected = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  return {
    available: true, low, expected, high, breakdown,
    assumptions: [
      ...requirements.assumptions,
      'Low/high range applies planning variance to estimated usage quantities; expected value uses the current catalog unit prices.',
      ...(model ? [model.assumption] : []),
    ],
    evidence: combinedEvidence, evidenceIds: combinedEvidence.map(item => item.id), currency: 'USD', missingCategories: [],
  }
}