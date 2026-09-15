import type { ArchitectureCatalogEntry } from '../catalog/architectureCatalog.js'
import { capacityScore, clampScore, thresholdScore } from '../scoring/dimensions.js'
import { scoringConfig } from '../scoring/config.js'

export type ScoringProfile = {
  problem: string
  latencySlaMs: number
  peakRequestsPerSecond: number
  requiresAI: boolean
  requiresGenAI: boolean
  requiresMultimodal: boolean
  requiresToolCalling: boolean
  requiresHumanReview: boolean
  realTimeScoring: boolean
  requiresSourceCitations: boolean | null
  securityRequirements: string[]
  sensitivity: string
  integrations: string
  existingTechnology: string
  signals: {
    predictiveScoring: boolean
    documentProcessing: boolean
    knowledgeRetrieval: boolean
    workflowOrchestration: boolean
    eventStreaming: boolean
  }
}

const clamp = clampScore
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 70

export function performanceScore(actualMs: number, requiredMs: number) {
  return thresholdScore(actualMs, requiredMs)
}

export function scalabilityScore(capacity: number, required: number) {
  return capacityScore(capacity, required)
}

export function relativeCostScore(cost: number, cheapestCost: number) {
  if (!Number.isFinite(cost) || !Number.isFinite(cheapestCost)) return 0
  return clamp(100 * cheapestCost / Math.max(1, cost))
}

export function architectureFit(candidate: ArchitectureCatalogEntry, profile: ScoringProfile) {
  const factors: number[] = []
  const capability = (required: boolean, supported: boolean) => required && factors.push(supported ? 100 : 20)
  capability(profile.requiresAI, candidate.capabilities.ai)
  capability(profile.requiresGenAI, candidate.capabilities.genAI)
  capability(profile.requiresMultimodal, candidate.capabilities.multimodal)
  capability(profile.requiresToolCalling, candidate.capabilities.toolCalling)
  capability(profile.requiresHumanReview, candidate.capabilities.humanReview)
  capability(profile.realTimeScoring, candidate.capabilities.realTime)
  capability(profile.signals.predictiveScoring, candidate.capabilities.predictiveScoring)
  capability(profile.signals.documentProcessing, candidate.capabilities.documentProcessing)
  capability(profile.signals.knowledgeRetrieval, candidate.capabilities.knowledgeRetrieval)
  capability(profile.signals.workflowOrchestration, candidate.capabilities.workflowOrchestration)
  capability(profile.signals.eventStreaming, candidate.capabilities.streaming)
  if (profile.requiresSourceCitations === true) factors.push(candidate.capabilities.sourceCitations ? 100 : 20)
  const score = clamp(average(factors))
  const explicitPattern = new RegExp(scoringConfig.microservicesFit.keywords.map(keyword => `\\b${keyword}\\b`).join('|'), 'i')
  const explicitlyRequestsMicroservices = explicitPattern.test(`${profile.problem} ${profile.existingTechnology}`)
  return candidate.id === 'microservices-ai' && !explicitlyRequestsMicroservices ? Math.min(score, scoringConfig.microservicesFit.explicitRequirementCap) : score
}

const controlMatchers: Record<string, RegExp> = {
  'PII Protection': /encryption|identity|content filtering|grounding/,
  'Data Loss Prevention': /content filtering|encryption|audit logging/,
  'Private Networking': /private endpoint|private networking/,
  'Customer-Managed Keys': /encryption/,
  'Multi-Factor Authentication': /identity|managed identity/,
}

export function securityScore(candidate: ArchitectureCatalogEntry, profile: ScoringProfile) {
  const required = [...profile.securityRequirements]
  if (profile.sensitivity !== 'Standard / Internal' && !required.includes('PII Protection')) required.push('PII Protection')
  if (!required.length) return candidate.security.score
  const controls = candidate.security.controls.join(' ').toLowerCase()
  const coverage = required.filter(requirement => controlMatchers[requirement]?.test(controls)).length / required.length
  return clamp(candidate.security.score * .6 + coverage * 40)
}

export function operationalFitScore(candidate: ArchitectureCatalogEntry, profile: ScoringProfile) {
  const integrations = profile.integrations.split(',').map(item => item.trim()).filter(Boolean).length
  const estate = profile.existingTechnology.toLowerCase()
  const containerFit = /kubernetes|container|microservice/.test(estate) && /event|hybrid|agentic|service/i.test(`${candidate.name} ${candidate.pattern}`) ? 8 : 0
  const integrationFit = integrations && /workflow|hybrid|service|event/i.test(`${candidate.name} ${candidate.pattern}`) ? Math.min(8, integrations * 2) : 0
  return clamp(candidate.operationalFit + containerFit + integrationFit - Math.max(0, integrations - 5) * 2)
}