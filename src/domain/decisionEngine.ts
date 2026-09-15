import { architectureCatalog, type ArchitectureCatalogEntry } from '../catalog/architectureCatalog.js'
import { evaluateModels, type Evidence, type ModelRequirements, type TokenUsage } from '../catalog/modelCatalog.js'
import { platformCatalog } from '../catalog/technologyCatalog.js'
import { clampScore } from '../scoring/dimensions.js'
import { scoringConfig } from '../scoring/config.js'
import { requirementGateFailures } from '../scoring/gates.js'
import { calculateArchitectureCost, type CostEstimate } from '../cost/costEngine.js'
import { calculateConfidence } from '../confidence/confidenceEngine.js'
import { estimateResources } from '../resource/resourceEstimator.js'
import { evaluatePerformance, type PerformanceEvaluation } from '../performance/performanceEngine.js'
import { composeLatency, type LatencyComposition } from '../performance/latencyModel.js'
import { evaluateScalability, type ScalabilityEvaluation } from '../scalability/scalabilityEngine.js'
import { evaluateSecurity, type SecurityEvaluation, type SecurityRequirement } from '../security/securityEngine.js'
import { evaluateAvailability, type AvailabilityEvaluation } from '../availability/availabilityEngine.js'

// Deterministic requirement status for a single architecture-vs-workload check. No numeric scores.
export type RequirementStatus = 'met' | 'partial' | 'notMet' | 'unknown'

export type RequirementResult = {
  requirement: string
  status: RequirementStatus
  // Display-only verdict for unknown rows whose estimate can still be compared against the target.
  indicator?: 'met' | 'notMet'
  explanation: string
  evidenceIds: string[]
}

// Any failedGate makes an architecture notEligible; any unknownGate (missing evidence) makes it partiallyEligible.
export type GateResult = {
  eligible: boolean
  failedGates: string[]
  passedGates: string[]
  unknownGates: string[]
}

export type WorkloadSignals = {
  predictiveScoring: boolean
  documentProcessing: boolean
  knowledgeRetrieval: boolean
  generativeResponse: boolean
  toolExecution: boolean
  workflowOrchestration: boolean
  humanReview: boolean
  eventStreaming: boolean
  realTime: boolean
}

export type WorkloadInput = {
  name: string
  problem: string
  scale: string
  aiRequirement: string
  latency: string
  sensitivity: string
  monthlyRequests: string
  peakRequestsPerMinute: string
  cloudPreference: string
  regulatoryRequirements: string[]
  securityRequirements: string[]
  existingTechnology: string
  integrations: string
  requiresSourceCitations: boolean | null
  capabilities: string[]
  workloads: string[]
  assumptions: string[]
  signals: WorkloadSignals
  potentialCompliance: string[]
  availabilityTarget?: string
  monthlyBudget?: number
}

export type WorkloadRequirements = {
  latencyMs: number
  throughputRps: number
  monthlyBudget?: number
  availabilityPercent: number
  realTime: boolean
  streaming: boolean
  predictiveScoring: boolean
  genAI: boolean
  multimodal: boolean
  humanReview: boolean
  documentProcessing: boolean
  knowledgeRetrieval: boolean
  workflowOrchestration: boolean
}

export type WorkloadProfile = WorkloadInput & {
  latencySlaMs: number
  monthlyRequestCount: number
  peakRequestsPerSecond: number
  requiresAI: boolean
  requiresGenAI: boolean
  requiresMultimodal: boolean
  requiresToolCalling: boolean
  requiresHumanReview: boolean
  realTimeScoring: boolean
  compliance: string[]
  suggestedCompliance: string[]
  tokenUsage: TokenUsage
  availabilityTargetPercent: number
  requirements: WorkloadRequirements
}

export type EvaluatedCandidate = {
  id: string
  name: string
  pattern: string
  description: string
  components: string[]
  strengths: string[]
  weaknesses: string[]
  status: 'eligible' | 'partiallyEligible' | 'notEligible'
  gates: GateResult
  requirementFit: RequirementResult[]
  p95LatencyMs: number
  latencyEstimate: LatencyComposition
  maxRequestsPerSecond: number
  complexityPenalty: number
  maintainability: number
  operationalFit: number
  availabilityTargetPercent: number
  metricsUpdatedAt: string
  catalogStatus: 'active' | 'deprecated' | 'experimental'
  evidenceQuality: number
  benchmarkCoverage: number
  evidence: Evidence[]
  eligible: boolean
  rejectionReasons: string[]
  monthlyCost: CostEstimate
  scalabilityHeadroom: number
  platformProvider: string
  platformScores: Record<string, number>
  selectedModel?: { id: string; name: string; score: number; monthlyCost: number; evidence: Evidence[] }
  technologies: Array<{ component: string; product: string; provider: string; layer: 'Edge & Network' | 'Services' | 'AI & Guardrails' | 'Data & Operations'; functionalRequirement: string; nonFunctionalRequirement: string; evidenceDate: string }>
  rankingReason: string
  capabilityOverreachCount: number
  overreachCapabilities: string[]
  evaluations: {
    performance: PerformanceEvaluation
    scalability: ScalabilityEvaluation
    security: SecurityEvaluation
    availability: AvailabilityEvaluation
  }
}

export type RecommendationSet = {
  bestOverall: EvaluatedCandidate
  lowestCost: EvaluatedCandidate
  bestPerformance: EvaluatedCandidate
  bestSecurity: EvaluatedCandidate
  bestScalability: EvaluatedCandidate
  lowestComplexity: EvaluatedCandidate
}

export type DecisionRisk = {
  severity: 'High' | 'Medium' | 'Low'
  title: string
  impact: string
  mitigation: string
}

export type DecisionTradeOff = {
  dimension: string
  selected: string
  rationale: string
  sacrifice: string
  alternative: string
  toString: () => string
}

const decisionTradeOff = (dimension: string, selected: EvaluatedCandidate, alternative: EvaluatedCandidate, rationale: string, sacrifice: string): DecisionTradeOff => ({
  dimension,
  selected: selected.name,
  rationale,
  sacrifice,
  alternative: alternative.name,
  toString: () => `${dimension}: selected ${selected.name} over ${alternative.name}. Reason: ${rationale} Trade-off accepted: ${sacrifice}`,
})

export type DecisionResult = {
  profile: WorkloadProfile
  platformOverride: string | null
  candidates: EvaluatedCandidate[]
  recommended: EvaluatedCandidate
  recommendations: RecommendationSet
  confidence: number
  confidenceLabel: 'High' | 'Medium' | 'Low'
  confidenceReasons: string[]
  reasons: string[]
  risks: DecisionRisk[]
  tradeOffs: DecisionTradeOff[]
  generatedAt: string
  catalogVersion: string
  catalogUpdatedAt: string
}

export const platformOptions = Object.keys(platformCatalog)

function scorePlatforms(profile: WorkloadProfile) {
  const estate = profile.existingTechnology.toLowerCase()
  const scores = Object.fromEntries(Object.keys(platformCatalog).map(provider => {
    let score = 70
    if (profile.cloudPreference !== 'No preference' && platformCatalog[profile.cloudPreference]) score = provider === profile.cloudPreference ? 100 : 0
    if ((provider === 'AWS' && /amazon|aws/.test(estate)) || (provider === 'Google Cloud' && /google|gcp|vertex/.test(estate)) || (provider === 'Azure' && /azure|microsoft|\.net/.test(estate)) || (provider === 'Open source' && /kubernetes|open source|on-prem/.test(estate))) score += 20
    if (profile.securityRequirements.length && provider !== 'Open source') score += 5
    if (profile.integrations.trim() && platformCatalog[provider]['Integration Layer']) score += 3
    return [provider, clamp(score)]
  }))
  return scores as Record<string, number>
}

function modelWorkload(profile: WorkloadProfile) {
  return profile.requiresToolCalling ? 'agentic' as const
    : profile.requiresSourceCitations || profile.signals.knowledgeRetrieval ? 'rag' as const
      : profile.signals.generativeResponse ? 'summarization' as const
        : 'extraction' as const
}

export function modelRequirementsFor(profile: WorkloadProfile, hostingProvider: string): ModelRequirements {
  const workload = modelWorkload(profile)
  return {
    hostingProvider,
    requiresImage: profile.requiresMultimodal,
    requiresToolCalling: profile.requiresToolCalling,
    requiresStructuredOutput: true,
    requiredContextWindow: workload === 'rag' ? 100_000 : 32_000,
    workload,
  }
}

export function applySelectedModel(candidate: EvaluatedCandidate, profile: WorkloadProfile, modelId?: string): EvaluatedCandidate {
  if (!modelId || !candidate.selectedModel) return candidate
  const evaluation = evaluateModels(modelRequirementsFor(profile, candidate.platformProvider), profile.tokenUsage).find(item => item.model.id === modelId && item.eligible)
  if (!evaluation) return candidate
  const previousCost = candidate.selectedModel.monthlyCost
  const costDifference = evaluation.monthlyCost - previousCost
  const selectedModel = { id: evaluation.model.id, name: evaluation.model.name, score: evaluation.score, monthlyCost: evaluation.monthlyCost, evidence: evaluation.model.evidence }
  const monthlyCost = {
    ...candidate.monthlyCost,
    low: candidate.monthlyCost.low + costDifference * 0.75,
    expected: candidate.monthlyCost.expected + costDifference,
    high: candidate.monthlyCost.high + costDifference * 1.35,
    breakdown: { ...candidate.monthlyCost.breakdown, Ai: Math.max(0, (candidate.monthlyCost.breakdown.Ai ?? 0) + costDifference) },
    evidence: [...candidate.monthlyCost.evidence.filter(item => item.metric !== 'model.pricing'), ...evaluation.model.evidence.filter(item => item.metric === 'model.pricing')],
    evidenceIds: [...candidate.monthlyCost.evidenceIds.filter(id => !candidate.selectedModel!.evidence.some(item => item.id === id && item.metric === 'model.pricing')), ...evaluation.model.evidence.filter(item => item.metric === 'model.pricing').map(item => item.id)],
    assumptions: [...candidate.monthlyCost.assumptions.filter(item => !item.includes(' token cost from published model pricing')), `${evaluation.model.name} token cost from published model pricing at ${profile.tokenUsage.requestsPerMonth.toLocaleString()} requests/month`],
  }
  return {
    ...candidate,
    selectedModel,
    monthlyCost,
    technologies: candidate.technologies.map(technology => /^(LLM|LLM Model|AI Model|AI Enrichment)$/.test(technology.component) ? { ...technology, product: evaluation.model.name } : technology),
    requirementFit: candidate.requirementFit.map(item => item.requirement === 'Compatible generative AI model' ? { ...item, explanation: `${evaluation.model.name} selected in Cost Analysis and passes required capability gates.`, evidenceIds: evaluation.model.evidence.map(evidence => evidence.id) } : item),
  }
}

function componentRequirements(component: string, profile: WorkloadProfile) {
  const functional = profile.capabilities[0] ?? profile.workloads[0] ?? 'Deliver the requested business capability'
  const secureData = `Protect ${profile.sensitivity.toLowerCase()} data${profile.securityRequirements.length ? ` with ${profile.securityRequirements.join(', ')}` : ''}`
  const mappings: Array<[RegExp, string, string]> = [
    [/identity|access/i, 'Authenticate users and enforce role-based access', secureData],
    [/api gateway|load balancer|web application firewall/i, 'Expose and govern application entry points', `Meet ${profile.latency} response time while protecting public endpoints`],
    [/private network/i, 'Connect application services without public data paths', secureData],
    [/application|application services|microservices runtime/i, functional, `Support ${profile.scale} with maintainable application scaling`],
    [/search index/i, 'Retrieve relevant governed knowledge for each request', `Return grounded results within the ${profile.latency.toLowerCase()} target`],
    [/embedding model/i, 'Convert source content and queries into semantic vectors', 'Maintain retrieval relevance while controlling AI inference cost'],
    [/llm|ai model|ai enrichment/i, 'Generate responses from the retrieved or processed context', 'Provide secure, cost-controlled AI responses with consistent output'],
    [/guardrail/i, 'Filter unsafe prompts and generated responses', secureData],
    [/document processing/i, 'Extract usable content from submitted documents', 'Process unstructured content accurately and consistently'],
    [/document store|object storage/i, 'Store governed source documents and processing artifacts', secureData],
    [/database|\bdb\b|state store|relational/i, 'Persist application, workflow, and decision state', `Support ${profile.monthlyRequests} monthly requests with durable data`],
    [/event stream|message queue/i, 'Decouple and route asynchronous workload events', `Handle peaks of ${profile.peakRequestsPerMinute} requests per minute`],
    [/workflow|human review|human approval/i, 'Route business steps and exceptions for human action', 'Preserve auditability and controlled execution'],
    [/rules engine/i, 'Apply deterministic business policies and decisions', 'Provide explainable and repeatable outcomes'],
    [/ml inference|ml service|feature store/i, 'Produce predictive scores from workload data', `Serve predictions within the ${profile.latency.toLowerCase()} target`],
    [/integration layer|tool gateway/i, `Connect ${profile.integrations || 'required enterprise systems'}`, 'Isolate dependencies and govern cross-system access'],
    [/monitor|observability/i, 'Capture health, usage, and decision telemetry', 'Support operational reliability, audit, and incident response'],
    [/compliance controls|key management|data protection/i, 'Enforce data governance and regulatory controls', secureData],
    [/cache/i, 'Accelerate repeated data access', `Meet ${profile.latency} response time under peak load`],
  ]
  const match = mappings.find(([pattern]) => pattern.test(component))
  return match ? { functionalRequirement: match[1], nonFunctionalRequirement: match[2] } : { functionalRequirement: functional, nonFunctionalRequirement: `Operate securely at ${profile.scale}` }
}

function resolveTechnologies(candidate: ArchitectureCatalogEntry, profile: WorkloadProfile, platformOverride?: string) {
  const platformScores = scorePlatforms(profile)
  const provider = platformOverride && platformCatalog[platformOverride]
    ? platformOverride
    : Object.entries(platformScores).sort((a, b) => b[1] - a[1])[0][0]
  const requirements = `${profile.problem} ${profile.securityRequirements.join(' ')} ${profile.integrations}`.toLowerCase()
  const components = candidate.components.filter(component => !/^(users|channels)$/i.test(component) && (profile.requiresGenAI || !/^(AI Model|AI Enrichment|LLM|Embedding Model)$/i.test(component)))
  if (profile.sensitivity !== 'Standard / Internal' || profile.securityRequirements.length) components.push('Identity & Access')
  if (profile.compliance.length) components.push('Compliance Controls')
  if (profile.requiresAI) components.push('Security Guardrails')
  if (profile.requiresGenAI && !components.some(component => /llm|ai model/i.test(component))) components.push('LLM Model')
  if (/private network|private endpoint|vnet|vpc|network isolation|zero trust/.test(requirements)) components.push('Private Network')
  if (profile.securityRequirements.includes('Customer-Managed Keys')) components.push('Key Management')
  if (profile.securityRequirements.includes('Data Loss Prevention') || profile.securityRequirements.includes('PII Protection')) components.push('Data Protection')
  if (/waf|web application firewall/.test(requirements)) components.push('Web Application Firewall')
  if (profile.integrations.trim()) components.push('Integration Layer')
  if (/microservice|container|kubernetes|\baks\b|\beks\b|\bgke\b/.test(requirements)) components.push('Microservices Runtime')
  const uniqueComponents = [...new Set(components)]
  const layerFor = (component: string) => /gateway|load balancer|network|identity/.test(component.toLowerCase()) ? 'Edge & Network' as const
    : /llm|ai |ml |model|guardrail|document processing|enrichment/.test(component.toLowerCase()) ? 'AI & Guardrails' as const
      : /database|db|store|storage|cache|monitor|observability|compliance/.test(component.toLowerCase()) ? 'Data & Operations' as const : 'Services' as const
  return {
    provider,
    platformScores,
    technologies: uniqueComponents.map(component => ({
      component,
      product: platformCatalog[provider][component] ?? component,
      provider,
      layer: layerFor(component),
      ...componentRequirements(component, profile),
      evidenceDate: '2026-08-01',
    })).sort((a, b) => ['Edge & Network', 'Services', 'AI & Guardrails', 'Data & Operations'].indexOf(a.layer) - ['Edge & Network', 'Services', 'AI & Guardrails', 'Data & Operations'].indexOf(b.layer)),
  }
}

const clamp = clampScore
const parseRange = (value: string, fallback: number) => {
  const normalized = value.replace(/,/g, '').toLowerCase()
  const values = [...normalized.matchAll(/([\d.]+)\s*(k|m)?/g)].map(match => Number(match[1]) * (match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1))
  return values.length ? values.reduce((sum, current) => sum + current, 0) / values.length : fallback
}

// Signal patterns are matched only against the extracted capability and workload lists, never
// against the free-form problem text, which frequently contains negations ("no orchestration").
const signalPatterns: Array<[keyof WorkloadSignals, RegExp]> = [
  ['predictiveScoring', /\b(defect|anomal\w*|classif\w+|predict\w*|forecast\w*|propensity|churn|fraud detection|risk scoring|credit scoring|object detection|image recognition|visual inspection|machine learning|ml inference)\b/],
  ['documentProcessing', /\b(vision|images?|cameras?|video|ocr|scan\w*|photo\w*|invoice\w*|document extraction)\b/],
  ['knowledgeRetrieval', /\b(retrieval|rag|knowledge base|semantic search|grounding|citations?|aggregat\w*.*(source|provider))\b/],
  ['generativeResponse', /\b(generative|summari[sz]\w+|chat\w*|assistant|natural language|content generation|compos\w*|assembl\w*|personali[sz]ed .*(plan|itinerary|recommendation))\b/],
  ['toolExecution', /\b(tool call\w*|function call\w*|agents?|external api|api invocation|search(?:es|ing)? and combin\w*|multi-source|aggregat\w*|external (?:service|inventory|provider)s?)\b/],
  ['workflowOrchestration', /\b(workflow|orchestration|approval|multi-step|state machine|continu\w* .*refin\w*|re-?plan\w*|re-?rank\w*|iterativ\w*|end-to-end)\b/],
  ['humanReview', /\b(human (?:review|approval|in-the-loop)|manual review|approval workflow|escalation)\b/],
  ['realTime', /\b(real[- ]?time|low[- ]latency|sub-second|streaming inference)\b/],
]


// The analyzer's boolean signals are advisory and often incomplete, so re-derive them from the
// structured capability and workload phrases it extracted. Signals are only ever added.
function deriveSignals(input: WorkloadInput): WorkloadSignals {
  const signals = { ...input.signals }
  if (input.aiRequirement === 'Not Required') return signals
  const phrases = [...input.capabilities, ...input.workloads].map(item => item.toLowerCase())
  for (const [signal, pattern] of signalPatterns) {
    if (!signals[signal]) signals[signal] = phrases.some(phrase => pattern.test(phrase))
  }
  return signals
}

export function buildWorkloadProfile(input: WorkloadInput): WorkloadProfile {
  // Check "15 seconds" before "5 seconds": the latter is a substring of the former.
  const latencySlaMs = input.latency.includes('500') ? 500
    : input.latency.includes('50 ms') ? 50
    : input.latency.includes('2 seconds') ? 2000
    : input.latency.includes('3 seconds') ? 3000
    : input.latency.includes('15 seconds') ? 15_000
    : input.latency.includes('10 seconds') ? 10_000
    : input.latency.includes('5 seconds') ? 5000
    : input.latency.includes('20 seconds') ? 20_000
    : 10_000
  const signals = deriveSignals(input)
  const signaledAI = signals.predictiveScoring || signals.documentProcessing || signals.knowledgeRetrieval || signals.generativeResponse || signals.toolExecution
  const requiresAI = input.aiRequirement === 'Required' || (input.aiRequirement === 'Let AI Determine' && signaledAI)
  const monthlyRequestCount = parseRange(input.monthlyRequests, 375_000)
  const peakRequestsPerSecond = Math.max(parseRange(input.peakRequestsPerMinute, 175) / 60, 1)
  const availabilityTargetPercent = Number(input.availabilityTarget?.replace('%', '')) || 99.9
  const requiresGenAI = requiresAI && (input.requiresSourceCitations === true || signals.generativeResponse || signals.knowledgeRetrieval || signals.toolExecution)
  const requiresMultimodal = requiresAI && signals.documentProcessing
  const explicitEventStreaming = /\b(event[- ]driven|event stream(?:ing)?|streaming events?|continuous event stream)\b/i.test(input.problem)
  return {
    ...input,
    signals: { ...signals, eventStreaming: signals.eventStreaming && explicitEventStreaming },
    latencySlaMs,
    monthlyRequestCount,
    peakRequestsPerSecond,
    requiresAI,
    requiresGenAI,
    requiresMultimodal,
    requiresToolCalling: requiresAI && signals.toolExecution,
    requiresHumanReview: signals.humanReview,
    realTimeScoring: signals.realTime,
    compliance: [...new Set(input.regulatoryRequirements)],
    suggestedCompliance: input.potentialCompliance.filter(item => !input.regulatoryRequirements.includes(item)),
    tokenUsage: {
      requestsPerMonth: monthlyRequestCount,
      inputTokensPerRequest: signals.documentProcessing || signals.knowledgeRetrieval ? 2_400 : 1_200,
      outputTokensPerRequest: signals.generativeResponse || signals.knowledgeRetrieval || signals.toolExecution ? 600 : 250,
      cachedInputTokensPerRequest: signals.knowledgeRetrieval ? 600 : 0,
    },
    availabilityTargetPercent,
    requirements: {
      latencyMs: latencySlaMs,
      throughputRps: peakRequestsPerSecond,
      availabilityPercent: availabilityTargetPercent,
      realTime: signals.realTime,
      streaming: signals.eventStreaming && explicitEventStreaming,
      predictiveScoring: signals.predictiveScoring,
      genAI: requiresGenAI,
      multimodal: requiresMultimodal,
      humanReview: signals.humanReview,
      documentProcessing: signals.documentProcessing,
      knowledgeRetrieval: signals.knowledgeRetrieval,
      workflowOrchestration: signals.workflowOrchestration,
      monthlyBudget: input.monthlyBudget,
    },
  }
}

function gateCandidate(candidate: ArchitectureCatalogEntry, profile: WorkloadProfile) {
  return requirementGateFailures(profile, candidate)
}

function selectModel(candidate: ArchitectureCatalogEntry, profile: WorkloadProfile, provider: string) {
  if (!profile.requiresGenAI || !candidate.capabilities.genAI) return undefined
  return evaluateModels(modelRequirementsFor(profile, provider), profile.tokenUsage).find(model => model.eligible)
}

// Managed PII discovery/DLP services documented by each provider. Open source has no vendor
// documentation of equivalent standing, so it is left without evidence rather than assumed.
const piiProtectionDocs: Record<string, { service: string; sourceName: string; sourceUrl: string }> = {
  Azure: { service: 'Microsoft Purview Data Loss Prevention', sourceName: 'Microsoft Purview data loss prevention documentation', sourceUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp' },
  AWS: { service: 'Amazon Macie', sourceName: 'Amazon Macie user guide', sourceUrl: 'https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html' },
  'Google Cloud': { service: 'Sensitive Data Protection', sourceName: 'Google Cloud Sensitive Data Protection documentation', sourceUrl: 'https://docs.cloud.google.com/sensitive-data-protection/docs/sensitive-data-protection-overview' },
}

function piiProtectionEvidence(provider: string): Evidence[] {
  const doc = piiProtectionDocs[provider]
  if (!doc) return []
  return [{
    id: `pii-protection:${provider}`, provider, dimension: 'security', metric: 'security.piiProtection', value: 'true',
    unit: 'supported', sourceType: 'official-documentation', sourceName: doc.sourceName, sourceUrl: doc.sourceUrl,
    retrievedAt: '2026-08-30T00:00:00Z', confidence: 95, metadata: { service: doc.service },
  }]
}

function candidateEvidence(candidate: ArchitectureCatalogEntry, provider: string, evidenceOverrides?: Record<string, Evidence[]>) {
  const combined = [...candidate.evidence, ...piiProtectionEvidence(provider), ...(evidenceOverrides?.[candidate.id] ?? [])]
  return [...new Map(combined.map(item => [item.id, item])).values()]
    .filter(item => (!item.architectureId || item.architectureId === candidate.id) && (!item.provider || item.provider === provider))
}

// Hard requirement gates + per-requirement status, without any numeric score.
function buildGatesAndFit(
  candidate: ArchitectureCatalogEntry,
  profile: WorkloadProfile,
  platformProvider: string,
  performance: PerformanceEvaluation,
  scalability: ScalabilityEvaluation,
  security: SecurityEvaluation,
  availability: AvailabilityEvaluation,
  monthlyCost: CostEstimate,
  securityRequirements: SecurityRequirement[],
  modelEvaluation: ReturnType<typeof selectModel>,
  latencyEstimate: LatencyComposition,
): { gates: GateResult; requirementFit: RequirementResult[] } {
  const failedGates: string[] = []
  const passedGates: string[] = []
  const unknownGates: string[] = []
  const requirementFit: RequirementResult[] = []

  failedGates.push(...gateCandidate(candidate, profile))

  const capabilityChecks: Array<[boolean, string, boolean]> = [
    [profile.requiresAI, 'AI capability', candidate.capabilities.ai],
    [profile.requiresMultimodal, 'Multimodal processing', candidate.capabilities.multimodal],
    [profile.requiresToolCalling, 'Tool calling', candidate.capabilities.toolCalling],
    [profile.requiresHumanReview, 'Human review', candidate.capabilities.humanReview],
    [profile.requiresSourceCitations === true, 'Source citations', candidate.capabilities.sourceCitations],
    [profile.signals.predictiveScoring, 'Predictive scoring', candidate.capabilities.predictiveScoring],
    [profile.signals.documentProcessing, 'Document processing', candidate.capabilities.documentProcessing],
    [profile.signals.knowledgeRetrieval, 'Knowledge retrieval', candidate.capabilities.knowledgeRetrieval],
    [profile.signals.workflowOrchestration, 'Workflow orchestration', candidate.capabilities.workflowOrchestration],
    [profile.signals.eventStreaming, 'Event streaming', candidate.capabilities.streaming],
  ]
  for (const [required, label, supported] of capabilityChecks) {
    if (!required) continue
    requirementFit.push({ requirement: label, status: supported ? 'met' : 'notMet', explanation: supported ? `${candidate.name} supports ${label.toLowerCase()}.` : `${candidate.name} does not support ${label.toLowerCase()}.`, evidenceIds: [] })
    if (supported) passedGates.push(label)
  }

  if (performance.p95LatencyMs === null) {
    const within = latencyEstimate.p95Ms <= profile.latencySlaMs
    // An estimate within target does not block eligibility; only a missing or unfavorable estimate does.
    if (!within) unknownGates.push('Performance (latency) evidence')
    requirementFit.push({ requirement: `Latency <= ${profile.latencySlaMs}ms`, status: 'unknown', indicator: within ? 'met' : 'notMet', explanation: `Estimated ${latencyEstimate.p95Ms}ms (${within ? 'within' : 'over'} target, not measured)`, evidenceIds: [] })
  } else if (performance.p95LatencyMs > profile.latencySlaMs) {
    failedGates.push(`Measured ${performance.p95LatencyMs}ms exceeds ${profile.latencySlaMs}ms requirement`)
    requirementFit.push({ requirement: `Latency <= ${profile.latencySlaMs}ms`, status: 'notMet', explanation: `Measured ${performance.p95LatencyMs}ms`, evidenceIds: performance.evidenceIds })
  } else {
    passedGates.push('Performance requirement')
    requirementFit.push({ requirement: `Latency <= ${profile.latencySlaMs}ms`, status: 'met', explanation: `Measured ${performance.p95LatencyMs}ms`, evidenceIds: performance.evidenceIds })
  }

  if (scalability.capacity === null) {
    const required = Math.ceil(profile.peakRequestsPerSecond)
    const within = scalability.estimatedCapacity !== null && scalability.estimatedCapacity >= profile.peakRequestsPerSecond
    // An estimate within target does not block eligibility; only a missing or unfavorable estimate does.
    if (!within) unknownGates.push('Scalability (capacity) evidence')
    const explanation = scalability.estimatedCapacity === null
      ? 'No capacity evidence'
      : `Estimated ${scalability.estimatedCapacity.toLocaleString()} req/s (${within ? 'within' : 'below'} target, not measured)`
    requirementFit.push({ requirement: `Capacity >= ${required} req/s`, status: 'unknown', indicator: scalability.estimatedCapacity === null ? undefined : within ? 'met' : 'notMet', explanation, evidenceIds: [] })
  } else if (scalability.capacity < profile.peakRequestsPerSecond) {
    failedGates.push(`Measured capacity ${scalability.capacity} req/s is below required ${Math.ceil(profile.peakRequestsPerSecond)}`)
    requirementFit.push({ requirement: `Capacity >= ${Math.ceil(profile.peakRequestsPerSecond)} req/s`, status: 'notMet', explanation: `Measured ${scalability.capacity.toLocaleString()} req/s`, evidenceIds: scalability.evidenceIds })
  } else {
    passedGates.push('Scalability requirement')
    requirementFit.push({ requirement: `Capacity >= ${Math.ceil(profile.peakRequestsPerSecond)} req/s`, status: 'met', explanation: `Measured ${scalability.capacity.toLocaleString()} req/s`, evidenceIds: scalability.evidenceIds })
  }

  if (securityRequirements.length) {
    for (const requirement of securityRequirements) {
      const status = security.controlStatus[requirement.control] ?? 'unknown'
      const documented = security.documentedControls.includes(requirement.control)
      const explanation = status === 'met' ? 'Supported' : status === 'notMet' ? 'Not supported' : documented ? 'Documented in catalog, not verified' : 'Not documented'
      requirementFit.push({ requirement: `Security control: ${requirement.label}`, status, indicator: status === 'unknown' && documented ? 'met' : undefined, explanation, evidenceIds: status === 'unknown' ? [] : security.evidenceIds })
    }
    if (security.missingControls.length) failedGates.push(`Missing mandatory security controls: ${security.missingControls.join(', ')}`)
    // A documented-but-unverified control does not block eligibility; a truly undocumented control does.
    if (securityRequirements.some(item => (security.controlStatus[item.control] ?? 'unknown') === 'unknown' && !security.documentedControls.includes(item.control))) unknownGates.push('Security control evidence')
    else if (!security.missingControls.length) passedGates.push('Security controls')
  }

  if (availability.slaPercent === null) {
    const within = availability.estimatedSlaPercent !== null && availability.estimatedSlaPercent >= profile.availabilityTargetPercent
    // An estimate within target does not block eligibility; only a missing or unfavorable estimate does.
    if (!within) unknownGates.push('Availability (SLA) evidence')
    const explanation = availability.estimatedSlaPercent === null
      ? 'No SLA evidence'
      : `Estimated ${availability.estimatedSlaPercent}% (${within ? 'within' : 'below'} target, not verified)`
    requirementFit.push({ requirement: `Availability >= ${profile.availabilityTargetPercent}%`, status: 'unknown', indicator: availability.estimatedSlaPercent === null ? undefined : within ? 'met' : 'notMet', explanation, evidenceIds: [] })
  } else if (availability.slaPercent < profile.availabilityTargetPercent) {
    failedGates.push(`Official SLA ${availability.slaPercent}% is below required ${profile.availabilityTargetPercent}%`)
    requirementFit.push({ requirement: `Availability >= ${profile.availabilityTargetPercent}%`, status: 'notMet', explanation: `Official SLA ${availability.slaPercent}%`, evidenceIds: availability.evidenceIds })
  } else {
    passedGates.push('Availability requirement')
    requirementFit.push({ requirement: `Availability >= ${profile.availabilityTargetPercent}%`, status: 'met', explanation: `Official SLA ${availability.slaPercent}%`, evidenceIds: availability.evidenceIds })
  }

  if (profile.requirements.monthlyBudget) {
    if (!monthlyCost.available) {
      unknownGates.push('Monthly cost evidence')
      requirementFit.push({ requirement: `Monthly cost <= $${profile.requirements.monthlyBudget.toLocaleString()}`, status: 'unknown', explanation: `Missing official prices for: ${monthlyCost.missingCategories.join(', ')}.`, evidenceIds: [] })
    } else if (monthlyCost.expected > profile.requirements.monthlyBudget) {
      failedGates.push(`Expected monthly cost $${monthlyCost.expected.toLocaleString()} exceeds $${profile.requirements.monthlyBudget.toLocaleString()} budget`)
      requirementFit.push({ requirement: `Monthly cost <= $${profile.requirements.monthlyBudget.toLocaleString()}`, status: 'notMet', explanation: `Expected monthly cost is $${monthlyCost.expected.toLocaleString()}.`, evidenceIds: monthlyCost.evidenceIds })
    } else {
      passedGates.push('Budget requirement')
      requirementFit.push({ requirement: `Monthly cost <= $${profile.requirements.monthlyBudget.toLocaleString()}`, status: 'met', explanation: `Expected monthly cost is $${monthlyCost.expected.toLocaleString()}.`, evidenceIds: monthlyCost.evidenceIds })
    }
  } else if (!monthlyCost.available) {
    requirementFit.push({ requirement: 'Expected monthly cost', status: 'unknown', explanation: `Missing official prices for: ${monthlyCost.missingCategories.join(', ')}.`, evidenceIds: [] })
  } else {
    requirementFit.push({ requirement: 'Expected monthly cost', status: 'met', explanation: `Expected monthly cost is $${monthlyCost.expected.toLocaleString()}.`, evidenceIds: monthlyCost.evidenceIds })
  }

  if (profile.requiresGenAI && candidate.capabilities.genAI) {
    if (!modelEvaluation) {
      failedGates.push(`No ${platformProvider} model passes required capability gates`)
      requirementFit.push({ requirement: 'Compatible generative AI model', status: 'notMet', explanation: `No ${platformProvider} model in the catalog passes required capability gates.`, evidenceIds: [] })
    } else {
      passedGates.push('Compatible generative AI model')
      requirementFit.push({ requirement: 'Compatible generative AI model', status: 'met', explanation: `${modelEvaluation.model.name} passes required capability gates.`, evidenceIds: modelEvaluation.model.evidence.map(item => item.id) })
    }
  }

  return { gates: { eligible: failedGates.length === 0, failedGates, passedGates, unknownGates }, requirementFit }
}

function rankingReasonFor(candidate: EvaluatedCandidate): string {
  if (candidate.status === 'notEligible') return `Rejected: ${candidate.gates.failedGates[0] ?? 'fails a mandatory requirement'}`
  if (candidate.status === 'partiallyEligible') return `Partially eligible: missing evidence for ${candidate.gates.unknownGates[0] ?? 'a mandatory requirement'}`
  return 'Recommended: satisfies all mandatory requirements with available evidence'
}

function evaluateCandidate(candidate: ArchitectureCatalogEntry, profile: WorkloadProfile, platformOverride?: string, evidenceOverrides?: Record<string, Evidence[]>): EvaluatedCandidate {
  const platform = resolveTechnologies(candidate, profile, platformOverride)
  const modelEvaluation = selectModel(candidate, profile, platform.provider)
  const evidence = candidateEvidence(candidate, platform.provider, evidenceOverrides)
  const modelCost = modelEvaluation
    ? { monthlyCost: modelEvaluation.monthlyCost, evidence: modelEvaluation.model.evidence.filter(item => item.metric === 'model.pricing'), assumption: `${modelEvaluation.model.name} token cost from published model pricing at ${profile.tokenUsage.requestsPerMonth.toLocaleString()} requests/month` }
    : undefined
  const monthlyCost = calculateArchitectureCost(estimateResources(profile, platform.provider, undefined, { name: candidate.name, ...candidate.operations }), evidence, modelCost)
  const performance = evaluatePerformance(profile.latencySlaMs, evidence)
  const scalability = evaluateScalability(profile.peakRequestsPerSecond, evidence)
  const securityRequirements: SecurityRequirement[] = profile.securityRequirements.map(control => ({ control: control.replace(/[^a-zA-Z]/g, ''), label: control, weight: 1 }))
  if (profile.sensitivity !== 'Standard / Internal' && !securityRequirements.some(item => item.control === 'encryptionAtRest')) securityRequirements.push({ control: 'encryptionAtRest', label: 'Encryption at rest', weight: 2 })
  const security = evaluateSecurity(securityRequirements, evidence)
  const availability = evaluateAvailability(profile.availabilityTargetPercent, evidence)
  const scalabilityHeadroom = scalability.capacityRatio
    ?? (scalability.estimatedCapacity === null ? Number.NaN : scalability.estimatedCapacity / Math.max(1, profile.peakRequestsPerSecond))
  const latencyEstimate = composeLatency(candidate.latencyFormula, modelEvaluation && { id: modelEvaluation.model.id, ttftMs: modelEvaluation.model.latency.ttftMs, outputTokensPerSecond: modelEvaluation.model.latency.outputTokensPerSecond, sourceType: modelEvaluation.model.latency.sourceType }, profile.tokenUsage.outputTokensPerRequest)
  const { gates, requirementFit } = buildGatesAndFit(candidate, profile, platform.provider, performance, scalability, security, availability, monthlyCost, securityRequirements, modelEvaluation, latencyEstimate)
  const evidenceQuality = evidence.length ? clamp(evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length) : 0
  const benchmarkCoverage = evidence.length ? clamp(evidence.filter(item => /benchmark/.test(item.sourceType)).length / evidence.length * 100) : 0
  const selectedModel = modelEvaluation ? { id: modelEvaluation.model.id, name: modelEvaluation.model.name, score: modelEvaluation.score, monthlyCost: modelEvaluation.monthlyCost, evidence: modelEvaluation.model.evidence } : undefined
  const technologies = platform.technologies.map(technology => selectedModel && /^(LLM|LLM Model|AI Model|AI Enrichment)$/.test(technology.component) ? { ...technology, product: selectedModel.name } : technology)
  const status: EvaluatedCandidate['status'] = gates.failedGates.length ? 'notEligible' : gates.unknownGates.length ? 'partiallyEligible' : 'eligible'
  const overreach = capabilityOverreachDetails(candidate.capabilities, profile)
  const candidateResult: EvaluatedCandidate = {
    id: candidate.id, name: candidate.name, pattern: candidate.pattern, description: candidate.description, components: candidate.components,
    strengths: candidate.strengths, weaknesses: candidate.weaknesses, status, gates, requirementFit,
    p95LatencyMs: performance.p95LatencyMs ?? Number.NaN, maxRequestsPerSecond: scalability.capacity ?? Number.NaN, latencyEstimate,
    complexityPenalty: candidate.complexityPenalty, maintainability: candidate.maintainability, operationalFit: candidate.operationalFit,
    availabilityTargetPercent: availability.slaPercent ?? Number.NaN, metricsUpdatedAt: candidate.metadata.lastUpdated, catalogStatus: candidate.metadata.status,
    evidenceQuality, benchmarkCoverage, evidence, eligible: status === 'eligible', rejectionReasons: gates.failedGates,
    monthlyCost, scalabilityHeadroom, platformProvider: platform.provider, platformScores: platform.platformScores,
    selectedModel, technologies, rankingReason: '', capabilityOverreachCount: overreach.count, overreachCapabilities: overreach.labels,
    evaluations: { performance, scalability, security, availability },
  }
  candidateResult.rankingReason = rankingReasonFor(candidateResult)
  return candidateResult
}

function statusRank(status: EvaluatedCandidate['status']) {
  return status === 'eligible' ? 0 : status === 'partiallyEligible' ? 1 : 2
}

const overreachCapabilityKeys = ['ai', 'genAI', 'multimodal', 'toolCalling', 'humanReview', 'sourceCitations', 'predictiveScoring', 'documentProcessing', 'knowledgeRetrieval', 'workflowOrchestration', 'streaming'] as const

const overreachCapabilityLabels: Record<typeof overreachCapabilityKeys[number], string> = {
  ai: 'general AI capability',
  genAI: 'generative AI',
  multimodal: 'multimodal processing',
  toolCalling: 'agentic tool calling',
  humanReview: 'human review workflow',
  sourceCitations: 'source citations',
  predictiveScoring: 'predictive scoring',
  documentProcessing: 'document processing',
  knowledgeRetrieval: 'knowledge retrieval',
  workflowOrchestration: 'workflow orchestration',
  streaming: 'event streaming',
}

function requiredCapabilityFlags(profile: WorkloadProfile) {
  return {
    ai: profile.requiresAI,
    genAI: profile.requiresGenAI,
    multimodal: profile.requiresMultimodal,
    toolCalling: profile.requiresToolCalling,
    humanReview: profile.requiresHumanReview,
    sourceCitations: profile.requiresSourceCitations === true,
    predictiveScoring: profile.signals.predictiveScoring,
    documentProcessing: profile.signals.documentProcessing,
    knowledgeRetrieval: profile.signals.knowledgeRetrieval,
    workflowOrchestration: profile.signals.workflowOrchestration,
    streaming: profile.signals.eventStreaming,
  }
}

// Identifies capabilities the architecture supports that the workload does not need. This is a
// deterministic requirement-fit tie-break (not a numeric quality score): it prefers the
// architecture that most closely matches the stated requirements over one that is
// over-provisioned with unneeded AI/agentic/tooling capability. The labels are also surfaced to
// the user so an eligible-but-overbuilt architecture is not mistaken for the recommendation.
function capabilityOverreachDetails(capabilities: ArchitectureCatalogEntry['capabilities'], profile: WorkloadProfile) {
  const required = requiredCapabilityFlags(profile)
  const keys = overreachCapabilityKeys.filter(key => capabilities[key] && !required[key])
  return { count: keys.length, labels: keys.map(key => overreachCapabilityLabels[key]) }
}

function compareCandidates(left: EvaluatedCandidate, right: EvaluatedCandidate) {
  return statusRank(left.status) - statusRank(right.status)
    || left.gates.failedGates.length - right.gates.failedGates.length
    || left.gates.unknownGates.length - right.gates.unknownGates.length
    || left.capabilityOverreachCount - right.capabilityOverreachCount
    || (left.monthlyCost.available && right.monthlyCost.available ? left.monthlyCost.expected - right.monthlyCost.expected : 0)
    || left.complexityPenalty - right.complexityPenalty
    || left.id.localeCompare(right.id)
}

export function runDecisionEngine(input: WorkloadInput, platformOverride?: string, evidenceOverrides?: Record<string, Evidence[]>): DecisionResult {
  const profile = buildWorkloadProfile(input)
  const selectedPlatform = platformOverride && platformCatalog[platformOverride] ? platformOverride : undefined
  const candidates = architectureCatalog.map(candidate => evaluateCandidate(candidate, profile, selectedPlatform, evidenceOverrides)).sort((left, right) => compareCandidates(left, right))
  const eligibleCandidates = candidates.filter(candidate => candidate.status === 'eligible')
  const partiallyEligibleCandidates = candidates.filter(candidate => candidate.status === 'partiallyEligible')
  const comparisonCandidates = eligibleCandidates.length ? eligibleCandidates : partiallyEligibleCandidates.length ? partiallyEligibleCandidates : candidates
  const recommended = comparisonCandidates[0]
  const runnerUp = comparisonCandidates[1]
  // Every eligible candidate previously reused the same "Recommended" wording, which made an
  // over-provisioned architecture look identical to the actual best fit. Only the top pick keeps
  // that wording; other eligible candidates now state why they were not selected.
  for (const candidate of candidates) {
    if (candidate.status !== 'eligible' || candidate.id === recommended.id) continue
    candidate.rankingReason = candidate.capabilityOverreachCount > 0
      ? `Eligible but over-provisioned: also supports ${candidate.overreachCapabilities.slice(0, 3).join(', ')}${candidate.capabilityOverreachCount > 3 ? ', and other capabilities' : ''} beyond this workload's requirements`
      : 'Eligible alternative: satisfies the same requirements with different cost, latency, or complexity trade-offs'
  }
  const completeness = clamp(55 + [input.latency, input.sensitivity, input.monthlyRequests, input.peakRequestsPerMinute].filter(Boolean).length * 9)
  const rankGap = (candidate: EvaluatedCandidate) => candidate.gates.failedGates.length * 100 + candidate.gates.unknownGates.length * 10
  const scoringStability = clamp(60 + Math.max(0, runnerUp ? rankGap(runnerUp) - rankGap(recommended) : 0) * 4)
  const confidenceResult = calculateConfidence({ evidence: [...recommended.evidence, ...(recommended.selectedModel?.evidence ?? [])], requirementCompleteness: completeness, scoringStability, assumptionCount: input.assumptions.length }, scoringConfig.confidence)
  const confidence = confidenceResult.confidence
  const confidenceReasons = [
    `${completeness}% requirement completeness`, `${confidenceResult.sourceReliability}% source reliability`, `${confidenceResult.freshness}% evidence freshness`, `${confidenceResult.measurementQuality}% measurement quality`,
    ...(input.assumptions.length > 3 ? [`${input.assumptions.length} assumptions reduce certainty`] : []),
    ...(scoringStability < 75 ? ['Top candidates have similar requirement fit'] : []),
  ]
  const reasons = [
    eligibleCandidates.length ? 'Passes every mandatory requirement gate with complete evidence' : partiallyEligibleCandidates.length ? 'No candidate has complete evidence for every gate; this is the strongest partially-eligible option' : 'No candidate passes every mandatory gate; this is the closest available fallback',
    `${recommended.gates.passedGates.length} requirement(s) confirmed met${recommended.gates.unknownGates.length ? `, ${recommended.gates.unknownGates.length} pending evidence` : ''}`,
    Number.isFinite(recommended.p95LatencyMs) ? `Measured latency ${recommended.p95LatencyMs}ms against ${profile.latencySlaMs}ms requirement` : 'Measured latency evidence is unavailable',
    Number.isFinite(recommended.scalabilityHeadroom) ? `${recommended.scalabilityHeadroom.toFixed(1)}x peak-load headroom` : 'Documented or measured capacity evidence is unavailable',
    recommended.rankingReason,
  ]
  const risks: DecisionRisk[] = []
  if (!eligibleCandidates.length) risks.push({ severity: 'High', title: 'No architecture cleared every mandatory gate', impact: 'The current recommendation cannot be approved as fully eligible because required capabilities or evidence remain unresolved.', mitigation: `Review and resolve: ${recommended.gates.failedGates.join('; ') || 'no failed gates'}${recommended.gates.unknownGates.length ? `; collect evidence for ${recommended.gates.unknownGates.join('; ')}` : ''}.` })
  if (profile.suggestedCompliance.length) risks.push({ severity: 'Medium', title: 'Confirm inferred compliance scope', impact: `The AI analysis identified possible regulatory relevance: ${profile.suggestedCompliance.slice(0, 2).join(', ')}${profile.suggestedCompliance.length > 2 ? ', and additional items' : ''}. These are advisory, not enforced gates.`, mitigation: 'Ask legal and compliance owners to confirm which regulations apply, then add confirmed requirements to the assessment before approval.' })
  if (!recommended.monthlyCost.available) risks.push({ severity: 'High', title: 'Monthly cost cannot be finalized', impact: `Required official price categories are missing: ${recommended.monthlyCost.missingCategories.join(', ')}. Procurement estimates would be incomplete.`, mitigation: `Collect official ${recommended.platformProvider} pricing for: ${recommended.monthlyCost.missingCategories.join(', ')}.` })
  if (recommended.gates.unknownGates.length) risks.push({ severity: 'Medium', title: 'Evidence gaps affect recommendation confidence', impact: `The architecture has unresolved requirements: ${recommended.gates.unknownGates.slice(0, 2).join('; ')}${recommended.gates.unknownGates.length > 2 ? '; and additional gates' : ''}.`, mitigation: `Collect current, provider-scoped evidence for: ${recommended.gates.unknownGates.join('; ')}.` })
  if (!Number.isFinite(recommended.maxRequestsPerSecond)) risks.push({ severity: 'High', title: 'Capacity is estimated, not measured', impact: `The current estimate is ${recommended.evaluations.scalability.estimatedCapacity?.toLocaleString() ?? 'unavailable'} req/s against a ${profile.peakRequestsPerSecond.toLocaleString()} req/s peak requirement, so production headroom is not yet proven.`, mitigation: 'Confirm documented service limits and run a production-like load test at the expected peak rate.' })
  else if (recommended.maxRequestsPerSecond < profile.peakRequestsPerSecond) risks.push({ severity: 'Medium', title: 'Measured capacity is below the peak requirement', impact: `Measured capacity is ${recommended.maxRequestsPerSecond.toLocaleString()} req/s, below the required ${profile.peakRequestsPerSecond.toLocaleString()} req/s.`, mitigation: `Load test horizontal scaling beyond ${recommended.maxRequestsPerSecond.toLocaleString()} req/s and revise the topology if it cannot meet peak demand.` })
  if (confidence < 70) risks.push({ severity: 'Medium', title: 'Decision confidence is limited by evidence quality', impact: `Decision confidence is ${confidence}%, so important inputs still rely on estimates or assumptions.`, mitigation: 'Replace assumptions with measured traffic, provider pricing, and benchmark evidence before final approval.' })
  for (const weakness of recommended.weaknesses.slice(0, Math.max(1, 3 - risks.length))) risks.push({ severity: 'Low', title: weakness, impact: `This is a known trade-off of the selected ${recommended.name} pattern.`, mitigation: 'Validate this trade-off in a focused proof of concept and architecture review.' })
  const cheapest = [...comparisonCandidates].sort((a, b) => a.monthlyCost.expected - b.monthlyCost.expected)[0]
  const fastest = [...comparisonCandidates].sort((a, b) => (Number.isFinite(a.p95LatencyMs) ? a.p95LatencyMs : Number.POSITIVE_INFINITY) - (Number.isFinite(b.p95LatencyMs) ? b.p95LatencyMs : Number.POSITIVE_INFINITY))[0]
  const mostSecure = [...comparisonCandidates].sort((a, b) => a.evaluations.security.missingControls.length - b.evaluations.security.missingControls.length || b.evaluations.security.supportedWeight - a.evaluations.security.supportedWeight)[0]
  const mostScalable = [...comparisonCandidates].sort((a, b) => (Number.isFinite(b.maxRequestsPerSecond) ? b.maxRequestsPerSecond : -1) - (Number.isFinite(a.maxRequestsPerSecond) ? a.maxRequestsPerSecond : -1))[0]
  const simplest = [...comparisonCandidates].sort((a, b) => a.complexityPenalty - b.complexityPenalty)[0]
  const recommendations: RecommendationSet = {
    bestOverall: recommended,
    lowestCost: cheapest,
    bestPerformance: fastest,
    bestSecurity: mostSecure,
    bestScalability: mostScalable,
    lowestComplexity: simplest,
  }
  const tradeOffs: DecisionTradeOff[] = [
    ...(recommended.monthlyCost.available && cheapest.monthlyCost.available && recommended.monthlyCost.expected > cheapest.monthlyCost.expected
      ? [decisionTradeOff('Cost', recommended, cheapest, `${recommended.name} better satisfies the mandatory requirements or has stronger evidence coverage.`, `$${(recommended.monthlyCost.expected - cheapest.monthlyCost.expected).toLocaleString()} higher expected monthly cost.`)]
      : []),
    ...(Number.isFinite(recommended.p95LatencyMs) && Number.isFinite(fastest.p95LatencyMs) && recommended.p95LatencyMs > fastest.p95LatencyMs
      ? [decisionTradeOff('Performance', recommended, fastest, `${recommended.name} better satisfies the mandatory requirements, cost, or evidence coverage.`, `${recommended.p95LatencyMs - fastest.p95LatencyMs}ms higher measured latency.`)]
      : []),
    ...(recommended.evaluations.security.missingControls.length > mostSecure.evaluations.security.missingControls.length
      ? [decisionTradeOff('Security', recommended, mostSecure, `${recommended.name} better satisfies the mandatory requirements, cost, or performance.`, `Missing controls: ${recommended.evaluations.security.missingControls.join(', ') || 'none'}.`)]
      : []),
    ...(Number.isFinite(recommended.maxRequestsPerSecond) && Number.isFinite(mostScalable.maxRequestsPerSecond) && recommended.maxRequestsPerSecond < mostScalable.maxRequestsPerSecond
      ? [decisionTradeOff('Scalability', recommended, mostScalable, `${recommended.name} better satisfies the mandatory requirements, cost, or security.`, `Measured capacity ${recommended.maxRequestsPerSecond.toLocaleString()} req/s versus ${mostScalable.maxRequestsPerSecond.toLocaleString()} req/s.`)]
      : []),
    ...(recommended.complexityPenalty > simplest.complexityPenalty
      ? [decisionTradeOff('Operational simplicity', recommended, simplest, `${recommended.name} better satisfies the mandatory requirements.`, `Higher relative operational complexity than ${simplest.name}.`)]
      : []),
  ]
  const nearestAlternative = runnerUp ?? candidates.find(candidate => candidate.id !== recommended.id)
  if (!tradeOffs.length && nearestAlternative) {
    const rationale = nearestAlternative.status === 'notEligible'
      ? `${recommended.name} satisfies mandatory gates that ${nearestAlternative.name} does not: ${nearestAlternative.gates.failedGates[0] ?? 'requirement mismatch'}.`
      : `${recommended.name} provides the closer requirement fit with lower cost or less capability overreach.`
    tradeOffs.push(decisionTradeOff(
      'Architecture topology',
      recommended,
      nearestAlternative,
      rationale,
      `Foregoes ${nearestAlternative.name}'s strength: ${nearestAlternative.strengths[0] ?? 'alternative deployment model'}.`,
    ))
  }
  const catalogVersion = architectureCatalog[0]?.metadata.version ?? 'unknown'
  const catalogUpdatedAt = architectureCatalog.map(candidate => candidate.metadata.lastUpdated).sort().at(-1) ?? new Date(0).toISOString()
  return { profile, platformOverride: selectedPlatform ?? null, candidates, recommended, recommendations, confidence, confidenceLabel: confidence >= 80 ? 'High' : confidence >= 65 ? 'Medium' : 'Low', confidenceReasons, reasons, risks: risks.slice(0, 3), tradeOffs, generatedAt: new Date().toISOString(), catalogVersion, catalogUpdatedAt }
}