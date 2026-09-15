import { calculateLLMCost, modelCapabilityGate, type ModelCatalogEntry, type ModelRequirements, type TokenUsage } from '../catalog/modelCatalog'

export type OptimizationId = 'rag-context' | 'conversation-history' | 'output-size' | 'model-selection' | 'prompt-caching' | 'response-caching' | 'agent-calls' | 'tool-calls' | 'duplicate-context'
export type OptimizationRisk = 'Low' | 'Medium' | 'High'

export type TokenBreakdown = {
  baseInputPerRequest: number
  ragContextPerRequest: number
  conversationHistoryPerRequest: number
  agentToolPerRequest: number
  duplicateContextPerRequest: number
  outputPerRequest: number
  cachedInputPerRequest: number
  effectiveRequestsPerMonth: number
  llmCallsPerRequest: number
}

export type OptimizationOpportunity = {
  id: OptimizationId
  label: string
  explanation: string
  useCaseFit: string
  nfrAlignment: string
  selectionGuidance: string
  qualityImpact: number
  complexityImpact: number
  risk: OptimizationRisk
}

export type OptimizationRequirements = {
  model: ModelRequirements
  maxLatencyMs: number
  minimumQuality: number
  minimumSecurity: number
  minimumReliability: number
  functionalRequirementsMet: boolean
  securityRequirementsMet: boolean
  complianceRequirementsMet: boolean
}

export type OptimizationUseCaseContext = {
  name: string
  architectureName: string
  provider: string
  workloads: string[]
  capabilities: string[]
  compliance: string[]
  securityRequirements: string[]
  latencyLabel: string
  monthlyRequests: string
  sensitivity: string
}

export type TokenOptimizationInput = {
  usage: TokenUsage
  model: ModelCatalogEntry
  models: ModelCatalogEntry[]
  requirements: OptimizationRequirements
  architectureOverheadMs: number
  signals: { knowledgeRetrieval: boolean; generativeResponse: boolean; toolExecution: boolean }
  useCase?: OptimizationUseCaseContext
}

export type OptimizationScenario = {
  id: string
  name: string
  optimizationIds: OptimizationId[]
  model: ModelCatalogEntry
  tokens: TokenBreakdown
  monthlyTokens: number
  monthlyCost: number
  tokenReductionPercent: number
  costReductionPercent: number
  latencyMs: number
  latencyImpactPercent: number
  quality: number
  qualityImpact: number
  complexityImpact: number
  risk: OptimizationRisk
  valid: boolean
  rejectionReasons: string[]
  score: number
  confidence: number
  explanation: string
  useCaseAlignment: string[]
  nfrAlignment: string
  selectionGuidance: string
}

export type TokenOptimizationResult = {
  baseline: OptimizationScenario
  opportunities: OptimizationOpportunity[]
  scenarios: OptimizationScenario[]
  recommended: OptimizationScenario | null
}

type MutableScenario = {
  tokens: TokenBreakdown
  model: ModelCatalogEntry
  qualityImpact: number
  complexityImpact: number
  risk: OptimizationRisk
  latencyFactor: number
}

const riskRank: Record<OptimizationRisk, number> = { Low: 0, Medium: 1, High: 2 }
const riskScore: Record<OptimizationRisk, number> = { Low: 100, Medium: 65, High: 30 }
const round = (value: number) => Math.round(value * 100) / 100
const percent = (baseline: number, value: number) => baseline > 0 ? Math.max(0, (baseline - value) / baseline * 100) : 0
const clamp = (value: number) => Math.max(0, Math.min(100, value))
const inputPerRequest = (tokens: TokenBreakdown) => tokens.baseInputPerRequest + tokens.ragContextPerRequest + tokens.conversationHistoryPerRequest + tokens.agentToolPerRequest + tokens.duplicateContextPerRequest
const monthlyTokens = (tokens: TokenBreakdown) => tokens.effectiveRequestsPerMonth * (inputPerRequest(tokens) + tokens.outputPerRequest)
const costFor = (model: ModelCatalogEntry, tokens: TokenBreakdown) => calculateLLMCost(model, {
  requestsPerMonth: tokens.effectiveRequestsPerMonth,
  inputTokensPerRequest: inputPerRequest(tokens),
  outputTokensPerRequest: tokens.outputPerRequest,
  cachedInputTokensPerRequest: Math.min(inputPerRequest(tokens), tokens.cachedInputPerRequest),
}).total
const latencyFor = (model: ModelCatalogEntry, tokens: TokenBreakdown, overheadMs: number, factor = 1) => Math.round((overheadMs + model.latency.ttftMs + tokens.outputPerRequest / Math.max(1, model.latency.outputTokensPerSecond) * 1000) * factor)
const unique = <T,>(items: T[]) => [...new Set(items)]
const shortList = (items: string[], fallback: string, max = 2) => items.length ? items.slice(0, max).join(', ') : fallback
const useCaseName = (input: TokenOptimizationInput) => input.useCase?.name || 'this use case'
const useCaseWork = (input: TokenOptimizationInput) => shortList(input.useCase?.workloads ?? [], shortList(input.useCase?.capabilities ?? [], 'the selected AI workload'))
const complianceText = (input: TokenOptimizationInput) => {
  const compliance = input.useCase?.compliance.length ? input.useCase.compliance.join(', ') : ''
  const security = input.useCase?.securityRequirements.length ? input.useCase.securityRequirements.slice(0, 2).join(', ') : ''
  if (compliance && security) return `${compliance} and ${security}`
  return compliance || security || input.useCase?.sensitivity || 'the selected assurance requirements'
}
const nfrTarget = (input: TokenOptimizationInput) => `${input.useCase?.latencyLabel || `${input.requirements.maxLatencyMs.toLocaleString()}ms`} latency, ${complianceText(input)}, ${input.useCase?.provider || input.requirements.model.hostingProvider || 'selected'} hosting, and minimum quality ${input.requirements.minimumQuality}`

function baselineTokens(input: TokenOptimizationInput): TokenBreakdown {
  const inputTokens = input.usage.inputTokensPerRequest
  const rag = input.signals.knowledgeRetrieval ? inputTokens * 0.35 : 0
  const history = input.signals.generativeResponse ? inputTokens * 0.2 : 0
  const agentTool = input.signals.toolExecution ? inputTokens * 0.2 : 0
  const duplicate = inputTokens * 0.1
  return {
    baseInputPerRequest: Math.max(0, inputTokens - rag - history - agentTool - duplicate),
    ragContextPerRequest: rag,
    conversationHistoryPerRequest: history,
    agentToolPerRequest: agentTool,
    duplicateContextPerRequest: duplicate,
    outputPerRequest: input.usage.outputTokensPerRequest,
    cachedInputPerRequest: input.usage.cachedInputTokensPerRequest ?? 0,
    effectiveRequestsPerMonth: input.usage.requestsPerMonth,
    llmCallsPerRequest: input.signals.toolExecution ? 3 : 1,
  }
}

function opportunitiesFor(input: TokenOptimizationInput): OptimizationOpportunity[] {
  const highAssurance = input.requirements.minimumSecurity >= 80 || input.requirements.minimumReliability >= 80 || input.requirements.complianceRequirementsMet
  const name = useCaseName(input)
  const work = useCaseWork(input)
  const nfr = nfrTarget(input)
  const monthlyRequests = input.useCase?.monthlyRequests || `${input.usage.requestsPerMonth.toLocaleString()} monthly requests`
  const architecture = input.useCase?.architectureName || 'the selected architecture'
  const opportunity = (item: OptimizationOpportunity) => item
  return [
    ...(input.signals.knowledgeRetrieval ? [opportunity({ id: 'rag-context', label: 'Reduce RAG context', explanation: 'Retrieve fewer, more relevant chunks before generation.', useCaseFit: `For ${name}, this targets ${work} by trimming retrieved evidence before it reaches ${architecture}; it is relevant because knowledge retrieval is active for this assessment.`, nfrAlignment: `Keep only source-ranked chunks so ${name} can preserve answer relevance while meeting ${nfr}.`, selectionGuidance: `Choose for ${name} when citations, retrieved documents, or policy snippets are useful but repeated or weakly relevant passages are inflating each prompt.`, qualityImpact: 3, complexityImpact: 2, risk: 'Low' })] : []),
    ...(input.signals.generativeResponse ? [opportunity({ id: 'conversation-history', label: 'Trim conversation history', explanation: 'Summarize older turns and retain only active context.', useCaseFit: `For ${name}, this fits ${work} when users iterate across multiple turns and the conversation starts carrying old decisions back into every request.`, nfrAlignment: `Retain recent turns, selected decisions, and user preferences so ${name} keeps continuity without violating ${nfr}.`, selectionGuidance: `Choose for ${name} when the journey needs memory of decisions but does not need the full transcript on every model call.`, qualityImpact: 2, complexityImpact: 3, risk: 'Low' })] : []),
    opportunity({ id: 'output-size', label: 'Limit output size', explanation: 'Apply concise response contracts and output-token limits.', useCaseFit: `For ${name}, this is relevant when ${work} should return structured decisions, summaries, actions, or extracted fields instead of long narrative responses.`, nfrAlignment: `Output tokens drive decode time, so shorter response contracts help ${name} meet ${nfr}.`, selectionGuidance: `Choose for ${name} when the user experience benefits from concise answers, tables, JSON, recommendations, or ADR-ready bullets.`, qualityImpact: 3, complexityImpact: 1, risk: 'Low' }),
    opportunity({ id: 'prompt-caching', label: 'Enable prompt caching', explanation: 'Cache stable system prompts and reusable instructions.', useCaseFit: `For ${name}, this fits ${monthlyRequests} when the same system prompt, policy pack, tool schema, or evaluation rubric is reused across requests.`, nfrAlignment: `Caching stable prompt prefixes is a low-risk optimization for ${highAssurance ? 'high-assurance' : 'standard'} ${name} traffic because it does not remove required context and still respects ${nfr}.`, selectionGuidance: `Choose for ${name} when provider support and prompt structure allow a stable prefix before dynamic request data.`, qualityImpact: 0, complexityImpact: 3, risk: 'Low' }),
    opportunity({ id: 'response-caching', label: 'Cache common responses', explanation: 'Serve repeated low-risk queries without a new model call.', useCaseFit: `For ${name}, this is relevant for repeatable ${work} requests where the same normalized input should produce the same answer.`, nfrAlignment: `Use cache invalidation and freshness keys so cached answers do not bypass ${complianceText(input)} or stale-data requirements.`, selectionGuidance: `Choose for ${name} only for low-risk repeat questions, deterministic lookups, or repeated eligibility checks; avoid it for personalized or changing decisions.`, qualityImpact: 1, complexityImpact: 5, risk: 'Medium' }),
    ...(input.signals.toolExecution ? [
      opportunity({ id: 'agent-calls', label: 'Reduce agent calls', explanation: 'Consolidate planning and reflection steps.', useCaseFit: `For ${name}, this targets agentic ${work} where planning, reflection, and verification can multiply LLM calls per user task.`, nfrAlignment: `Reduce loops for cost and latency, but keep validation, human review, and safety checks needed for ${nfr}.`, selectionGuidance: `Choose for ${name} when repeated agent reasoning steps can be replaced with deterministic checks or a single planned execution pass.`, qualityImpact: 4, complexityImpact: 4, risk: 'Medium' }),
      opportunity({ id: 'tool-calls', label: 'Reduce tool calls', explanation: 'Batch compatible tool requests and reuse results.', useCaseFit: `For ${name}, this fits tool-using ${work} when search, pricing, policy, workflow, or integration calls repeat during one task.`, nfrAlignment: `Batching reduces network fan-out for ${name} while preserving evidence required by ${nfr}.`, selectionGuidance: `Choose for ${name} when tool calls are independent, cacheable, or can share one retrieval/result set without changing the business decision.`, qualityImpact: 2, complexityImpact: 4, risk: 'Medium' }),
    ] : []),
    opportunity({ id: 'duplicate-context', label: 'Remove duplicate context', explanation: 'Deduplicate repeated policies, retrieved text, and tool results.', useCaseFit: `For ${name}, this is the safest first pass when ${work} prompts repeat requirements, retrieved chunks, governance text, or tool results.`, nfrAlignment: `Removes waste without weakening functional behavior or ${complianceText(input)} controls for ${name}.`, selectionGuidance: `Choose for ${name} when the prompt includes the same instructions, policy snippets, evidence, or integration results in more than one section.`, qualityImpact: 0, complexityImpact: 2, risk: 'Low' }),
    opportunity({ id: 'model-selection', label: 'Select a lower-cost valid model', explanation: 'Use the lowest-cost model that still passes all hard requirements.', useCaseFit: `For ${name}, route routine ${work} requests to the lowest-cost capable model while keeping ${input.model.name} only when the task needs it.`, nfrAlignment: `Only models that pass ${nfr}, required context window, structured output, image, and tool-calling gates remain selectable.`, selectionGuidance: `Choose for ${name} when the workload has clear tiers: simple extraction or lookup requests separate from reasoning-heavy or tool-heavy requests.`, qualityImpact: 0, complexityImpact: 1, risk: 'Low' }),
  ]
}

function applyOptimization(state: MutableScenario, opportunity: OptimizationOpportunity, input: TokenOptimizationInput): void {
  if (opportunity.id === 'rag-context') state.tokens.ragContextPerRequest *= 0.65
  if (opportunity.id === 'conversation-history') state.tokens.conversationHistoryPerRequest *= 0.5
  if (opportunity.id === 'output-size') state.tokens.outputPerRequest *= 0.75
  if (opportunity.id === 'prompt-caching') state.tokens.cachedInputPerRequest = Math.max(state.tokens.cachedInputPerRequest, inputPerRequest(state.tokens) * 0.4)
  if (opportunity.id === 'response-caching') state.tokens.effectiveRequestsPerMonth *= 0.85
  if (opportunity.id === 'agent-calls') {
    state.tokens.agentToolPerRequest *= 0.7
    state.tokens.llmCallsPerRequest = Math.max(1, state.tokens.llmCallsPerRequest - 1)
  }
  if (opportunity.id === 'tool-calls') state.tokens.agentToolPerRequest *= 0.8
  if (opportunity.id === 'duplicate-context') state.tokens.duplicateContextPerRequest *= 0.3
  if (opportunity.id === 'model-selection') {
    const validModels = input.models.filter(model => !modelCapabilityGate(model, input.requirements.model).length && model.qualityScores[input.requirements.model.workload] >= input.requirements.minimumQuality && model.securityScore >= input.requirements.minimumSecurity && model.reliabilityScore >= input.requirements.minimumReliability)
    state.model = [...validModels].sort((left, right) => costFor(left, state.tokens) - costFor(right, state.tokens))[0] ?? state.model
  }
  if (['rag-context', 'conversation-history', 'output-size', 'prompt-caching', 'agent-calls', 'tool-calls', 'duplicate-context'].includes(opportunity.id)) state.latencyFactor *= opportunity.id === 'output-size' ? 0.88 : 0.97
  state.qualityImpact += opportunity.qualityImpact
  state.complexityImpact += opportunity.complexityImpact
  if (riskRank[opportunity.risk] > riskRank[state.risk]) state.risk = opportunity.risk
}

function validate(state: MutableScenario, input: TokenOptimizationInput, latencyMs: number, quality: number): string[] {
  return [
    ...modelCapabilityGate(state.model, input.requirements.model),
    ...(latencyMs > input.requirements.maxLatencyMs ? [`Estimated latency ${latencyMs}ms exceeds ${input.requirements.maxLatencyMs}ms`] : []),
    ...(quality < input.requirements.minimumQuality ? [`Quality ${quality} is below ${input.requirements.minimumQuality}`] : []),
    ...(state.model.securityScore < input.requirements.minimumSecurity ? ['Security requirement is not met'] : []),
    ...(state.model.reliabilityScore < input.requirements.minimumReliability ? ['Availability requirement is not met'] : []),
    ...(!input.requirements.functionalRequirementsMet ? ['Functional requirements are not met'] : []),
    ...(!input.requirements.securityRequirementsMet ? ['Architecture security requirements are not met'] : []),
    ...(!input.requirements.complianceRequirementsMet ? ['Compliance requirements are not met'] : []),
  ]
}

function buildScenario(name: string, ids: OptimizationId[], input: TokenOptimizationInput, baseline: { tokens: number; cost: number; latency: number }): OptimizationScenario {
  const opportunities = opportunitiesFor(input)
  const state: MutableScenario = { tokens: structuredClone(baselineTokens(input)), model: input.model, qualityImpact: 0, complexityImpact: 0, risk: 'Low', latencyFactor: 1 }
  const selectedOpportunities: OptimizationOpportunity[] = []
  for (const id of ids) {
    const opportunity = opportunities.find(item => item.id === id)
    if (opportunity) {
      selectedOpportunities.push(opportunity)
      applyOptimization(state, opportunity, input)
    }
  }
  const totalTokens = monthlyTokens(state.tokens)
  const cost = costFor(state.model, state.tokens)
  const latency = latencyFor(state.model, state.tokens, input.architectureOverheadMs, state.latencyFactor)
  const quality = Math.round(state.model.qualityScores[input.requirements.model.workload] - state.qualityImpact)
  const rejections = validate(state, input, latency, quality)
  const tokenReduction = percent(baseline.tokens, totalTokens)
  const costReduction = percent(baseline.cost, cost)
  const latencyImpact = baseline.latency > 0 ? (latency - baseline.latency) / baseline.latency * 100 : 0
  const performance = clamp(input.requirements.maxLatencyMs / Math.max(1, latency) * 100)
  const score = rejections.length ? 0 : Math.round(clamp(costReduction) * 0.25 + clamp(tokenReduction) * 0.2 + quality * 0.2 + performance * 0.15 + state.model.securityScore * 0.1 + clamp(100 - state.complexityImpact * 6) * 0.05 + riskScore[state.risk] * 0.05)
  const confidence = Math.round(state.model.evidence.length ? state.model.evidence.reduce((sum, evidence) => sum + evidence.confidence, 0) / state.model.evidence.length : 50)
  const labels = selectedOpportunities.map(item => item.label)
  const useCaseAlignment = ids.length ? unique(selectedOpportunities.map(item => item.useCaseFit)) : ['Baseline reflects the current use case, model, request volume, token mix, and active NFR gates.']
  const nfrAlignment = ids.length ? unique(selectedOpportunities.map(item => item.nfrAlignment)).join(' ') : 'Current model and token usage are checked against latency, quality, security, reliability, functional, and compliance requirements.'
  const selectionGuidance = ids.length ? unique(selectedOpportunities.map(item => item.selectionGuidance)).join(' ') : 'Use as the reference point before applying cost, latency, context, caching, or model-routing changes.'
  return {
    id: ids.length ? ids.join('+') : 'baseline', name, optimizationIds: ids, model: state.model, tokens: state.tokens,
    monthlyTokens: round(totalTokens), monthlyCost: round(cost), tokenReductionPercent: round(tokenReduction), costReductionPercent: round(costReduction),
    latencyMs: latency, latencyImpactPercent: round(latencyImpact), quality, qualityImpact: state.qualityImpact, complexityImpact: state.complexityImpact,
    risk: state.risk, valid: !rejections.length, rejectionReasons: rejections, score, confidence,
    explanation: ids.length ? `${labels.join(' + ')} → ${round(tokenReduction)}% fewer tokens → ${round(costReduction)}% lower model cost → ${state.qualityImpact ? `${state.qualityImpact}-point quality impact` : 'minimal quality impact'} → ${state.risk.toLowerCase()} risk` : 'Current workload, architecture, model, pricing, and requirements.',
    useCaseAlignment,
    nfrAlignment,
    selectionGuidance,
  }
}

export function simulateTokenOptimization(input: TokenOptimizationInput, optimizationIds: OptimizationId[], name = 'Custom optimization'): OptimizationScenario {
  const initialTokens = baselineTokens(input)
  const baseline = {
    tokens: monthlyTokens(initialTokens),
    cost: costFor(input.model, initialTokens),
    latency: latencyFor(input.model, initialTokens, input.architectureOverheadMs),
  }
  const applicable = new Set(opportunitiesFor(input).map(item => item.id))
  const selected = [...new Set(optimizationIds)].filter(id => applicable.has(id))
  return buildScenario(name, selected, input, baseline)
}

export function optimizeTokenCost(input: TokenOptimizationInput): TokenOptimizationResult {
  const initialTokens = baselineTokens(input)
  const baselineValues = { tokens: monthlyTokens(initialTokens), cost: costFor(input.model, initialTokens), latency: latencyFor(input.model, initialTokens, input.architectureOverheadMs) }
  const baseline = buildScenario('Baseline', [], input, baselineValues)
  const opportunities = opportunitiesFor(input)
  const scenarioIds: OptimizationId[][] = [
    ...opportunities.map(opportunity => [opportunity.id]),
    opportunities.filter(item => ['rag-context', 'conversation-history', 'prompt-caching', 'duplicate-context'].includes(item.id)).map(item => item.id),
    opportunities.filter(item => ['rag-context', 'conversation-history', 'output-size', 'prompt-caching', 'response-caching', 'agent-calls', 'tool-calls', 'duplicate-context', 'model-selection'].includes(item.id)).map(item => item.id),
  ]
  const uniqueScenarios = [...new Map(scenarioIds.filter(ids => ids.length).map(ids => [ids.join('+'), ids])).values()]
  const scenarios = uniqueScenarios.map((ids, index) => buildScenario(index === uniqueScenarios.length - 2 ? 'Balanced optimization' : index === uniqueScenarios.length - 1 ? 'Maximum valid savings' : opportunities.find(item => item.id === ids[0])?.label ?? 'Optimization', ids, input, baselineValues))
    .sort((left, right) => Number(right.valid) - Number(left.valid) || right.score - left.score || right.confidence - left.confidence || left.monthlyCost - right.monthlyCost)
  return { baseline, opportunities, scenarios, recommended: scenarios.find(scenario => scenario.valid) ?? null }
}
