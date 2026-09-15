export type EvidenceType = 'official-api' | 'official-documentation' | 'official-sla' | 'independent-benchmark' | 'internal-benchmark' | 'expert-rule' | 'assumption'
export type EvidenceDimension = 'cost' | 'performance' | 'scalability' | 'security' | 'availability' | 'quality' | 'reliability'

export type Evidence = {
  id: string
  provider?: string
  service?: string
  architectureId?: string
  modelId?: string
  dimension: EvidenceDimension
  metric: string
  value: string | number
  unit?: string
  sourceType: EvidenceType
  sourceName: string
  sourceUrl?: string
  retrievedAt: string
  effectiveDate?: string
  expiresAt?: string
  confidence: number
  metadata?: Record<string, unknown>
}

export type ModelCapability = {
  text: boolean
  image: boolean
  audio: boolean
  video: boolean
  reasoning: number
  toolCalling: boolean
  structuredOutput: boolean
  contextWindow: number
  maxOutputTokens?: number
}

export type ModelPricing = {
  inputPer1M: number
  cachedInputPer1M?: number
  outputPer1M: number
  currency: 'USD'
  effectiveDate: string
  sourceUrl: string
}

export type ModelCatalogEntry = {
  id: string
  name: string
  provider: string
  hostingProviders: string[]
  capabilities: ModelCapability
  pricing: ModelPricing
  qualityScores: { reasoning: number; extraction: number; summarization: number; rag: number; agentic: number }
  latency: { ttftMs: number; outputTokensPerSecond: number; p50Ms: number; p95Ms: number; sourceType: EvidenceType; sourceUrl: string; measuredAt: string }
  latencyScore: number
  reliabilityScore: number
  securityScore: number
  evidence: Evidence[]
}

export type TokenUsage = {
  requestsPerMonth: number
  inputTokensPerRequest: number
  outputTokensPerRequest: number
  cachedInputTokensPerRequest?: number
}

export type ModelRequirements = {
  hostingProvider: string
  requiresImage: boolean
  requiresToolCalling: boolean
  requiresStructuredOutput: boolean
  requiredContextWindow: number
  workload: 'extraction' | 'summarization' | 'rag' | 'agentic'
}

export type EvaluatedModel = {
  model: ModelCatalogEntry
  eligible: boolean
  failures: string[]
  score: number
  monthlyCost: number
}

export type ModelScoringWeights = {
  workloadQuality: number
  latency: number
  costEfficiency: number
  reasoning: number
  security: number
  reliability: number
}

export const modelCatalog: ModelCatalogEntry[] = []
export const modelScoringWeights = {} as ModelScoringWeights

export function hydrateModelCatalog(models: ModelCatalogEntry[], weights: ModelScoringWeights) {
  modelCatalog.splice(0, modelCatalog.length, ...models)
  for (const key of Object.keys(modelScoringWeights)) delete modelScoringWeights[key as keyof ModelScoringWeights]
  Object.assign(modelScoringWeights, weights)
}

// Normalizes caller-supplied weights to fractions summing to 1 against the catalog default.
export function normalizeModelWeights(requested: Partial<ModelScoringWeights>): ModelScoringWeights {
  const merged = { ...modelScoringWeights, ...requested }
  const total = Object.values(merged).reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (!total) return { ...modelScoringWeights }
  return Object.fromEntries(Object.entries(merged).map(([key, weight]) => [key, Math.max(0, weight) / total])) as ModelScoringWeights
}

export function modelCapabilityGate(model: ModelCatalogEntry, requirements: ModelRequirements): string[] {
  const failures: string[] = []
  if (!model.hostingProviders.includes(requirements.hostingProvider)) failures.push(`Not hosted on ${requirements.hostingProvider}`)
  if (requirements.requiresImage && !model.capabilities.image) failures.push('Image input required')
  if (requirements.requiresToolCalling && !model.capabilities.toolCalling) failures.push('Tool calling required')
  if (requirements.requiresStructuredOutput && !model.capabilities.structuredOutput) failures.push('Structured output required')
  if (model.capabilities.contextWindow < requirements.requiredContextWindow) failures.push(`Context window below ${requirements.requiredContextWindow.toLocaleString()} tokens`)
  return failures
}

export function calculateLLMCost(model: ModelCatalogEntry, usage: TokenUsage) {
  const inputTokens = usage.requestsPerMonth * usage.inputTokensPerRequest
  const outputTokens = usage.requestsPerMonth * usage.outputTokensPerRequest
  const cachedTokens = Math.min(inputTokens, usage.requestsPerMonth * (usage.cachedInputTokensPerRequest ?? 0))
  const inputCost = (inputTokens - cachedTokens) / 1_000_000 * model.pricing.inputPer1M
  const cachedCost = cachedTokens / 1_000_000 * (model.pricing.cachedInputPer1M ?? model.pricing.inputPer1M)
  const outputCost = outputTokens / 1_000_000 * model.pricing.outputPer1M
  return { inputCost, cachedCost, outputCost, total: inputCost + cachedCost + outputCost }
}

export function evaluateModels(requirements: ModelRequirements, usage: TokenUsage, weights: ModelScoringWeights = modelScoringWeights): EvaluatedModel[] {
  const evaluated = modelCatalog.map(model => {
    const failures = modelCapabilityGate(model, requirements)
    const monthlyCost = calculateLLMCost(model, usage).total
    return { model, eligible: failures.length === 0, failures, monthlyCost, score: 0 }
  })
  const eligible = evaluated.filter(item => item.eligible)
  const cheapest = Math.min(...eligible.map(item => item.monthlyCost))
  for (const item of evaluated) {
    if (!item.eligible) continue
    const costScore = item.monthlyCost ? Math.min(100, 100 * cheapest / item.monthlyCost) : 100
    item.score = Math.round(
      item.model.qualityScores[requirements.workload] * weights.workloadQuality
      + item.model.latencyScore * weights.latency
      + costScore * weights.costEfficiency
      + item.model.capabilities.reasoning * weights.reasoning
      + item.model.securityScore * weights.security
      + item.model.reliabilityScore * weights.reliability,
    )
  }
  return evaluated.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)
}

export function calculateBlendedModelCost(routes: Array<{ modelId: string; percentage: number }>, usage: TokenUsage) {
  return routes.reduce((total, route) => {
    const model = modelCatalog.find(item => item.id === route.modelId)
    if (!model) return total
    return total + calculateLLMCost(model, { ...usage, requestsPerMonth: usage.requestsPerMonth * route.percentage / 100 }).total
  }, 0)
}
