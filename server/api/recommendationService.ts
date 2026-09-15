import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { architectureCatalog } from '../../src/catalog/architectureCatalog.js'
import { hydrateDecisionCatalog, type DecisionCatalog } from '../../src/catalog/catalogClient.js'
import { runDecisionEngine, type DecisionResult, type WorkloadInput } from '../../src/domain/decisionEngine.js'
import { validateEvidenceSet } from '../../src/evidence/validation.js'
import { searchEvidence } from '../evidence/azureAiSearchEvidenceStore.js'

export type RecommendationRequest = { assessment: WorkloadInput; platform?: string }
export type RecommendationDependencies = { search: typeof searchEvidence }
export type RecommendationResponse = {
  recommendation: { architectureId: string; architectureName: string; status: DecisionResult['recommended']['status']; confidence: number }
  requirementFit: DecisionResult['recommended']['requirementFit']
  alternatives: Array<{ architectureId: string; architectureName: string; status: DecisionResult['recommended']['status']; whyConsidered: string; tradeoffs: string[] }>
  cost: { total: number | null; currency: string; breakdown: Record<string, number>; available: boolean }
  evidence: DecisionResult['recommended']['evidence']
  decision: { whySelected: string[]; risks: DecisionResult['risks']; tradeoffs: DecisionResult['tradeOffs']; assumptions: string[] }
  trace: DecisionResult
}

let hydratedVersion = ''
const platforms = new Set(['Azure', 'AWS', 'Google Cloud', 'Open source'])
const signalNames = ['predictiveScoring', 'documentProcessing', 'knowledgeRetrieval', 'generativeResponse', 'toolExecution', 'workflowOrchestration', 'humanReview', 'eventStreaming', 'realTime'] as const

const boundedString = (value: unknown, minLength: number, maxLength: number) => typeof value === 'string' && value.trim().length >= minLength && value.length <= maxLength
const boundedStringList = (value: unknown, maxItems: number) => Array.isArray(value)
  && value.length <= maxItems
  && value.every(item => boundedString(item, 1, 200))

async function ensureCatalog() {
  const payload = JSON.parse(await readFile(resolve('server/catalog/decision-catalog.json'), 'utf8')) as DecisionCatalog
  if (payload.catalogVersion !== hydratedVersion) {
    hydrateDecisionCatalog(payload)
    hydratedVersion = payload.catalogVersion
  }
}

export function isRecommendationRequest(value: unknown): value is RecommendationRequest {
  if (!value || typeof value !== 'object') return false
  const request = value as Partial<RecommendationRequest>
  const assessment = request.assessment
  if (!assessment || typeof assessment !== 'object') return false
  const requiredShortFields = [assessment.name, assessment.scale, assessment.aiRequirement, assessment.latency, assessment.sensitivity, assessment.monthlyRequests, assessment.peakRequestsPerMinute, assessment.cloudPreference]
  const validSignals = assessment.signals && signalNames.every(name => typeof assessment.signals[name] === 'boolean')
  return boundedString(assessment.problem, 20, 8_000)
    && requiredShortFields.every(field => boundedString(field, 1, 200))
    && boundedString(assessment.existingTechnology, 0, 2_000)
    && boundedString(assessment.integrations, 0, 2_000)
    && boundedStringList(assessment.regulatoryRequirements, 20)
    && boundedStringList(assessment.securityRequirements, 20)
    && boundedStringList(assessment.capabilities, 20)
    && boundedStringList(assessment.workloads, 20)
    && boundedStringList(assessment.assumptions, 20)
    && boundedStringList(assessment.potentialCompliance, 20)
    && (assessment.requiresSourceCitations === null || typeof assessment.requiresSourceCitations === 'boolean')
    && Boolean(validSignals)
    && (assessment.availabilityTarget === undefined || boundedString(assessment.availabilityTarget, 1, 50))
    && (assessment.monthlyBudget === undefined || (Number.isFinite(assessment.monthlyBudget) && assessment.monthlyBudget >= 0 && assessment.monthlyBudget <= 1_000_000_000))
    && (request.platform === undefined || platforms.has(request.platform))
}

export function recommendationResponse(result: DecisionResult): RecommendationResponse {
  const selected = result.recommended
  return {
    recommendation: { architectureId: selected.id, architectureName: selected.name, status: selected.status, confidence: result.confidence },
    requirementFit: selected.requirementFit,
    alternatives: result.candidates.filter(item => item.id !== selected.id).map(item => ({ architectureId: item.id, architectureName: item.name, status: item.status, whyConsidered: item.rankingReason, tradeoffs: result.tradeOffs.filter(tradeoff => tradeoff.alternative === item.name).map(tradeoff => tradeoff.toString()) })),
    cost: { total: selected.monthlyCost.available ? selected.monthlyCost.expected : null, currency: selected.monthlyCost.currency, breakdown: selected.monthlyCost.breakdown, available: selected.monthlyCost.available },
    evidence: selected.evidence,
    decision: { whySelected: result.reasons, risks: result.risks, tradeoffs: result.tradeOffs, assumptions: [...result.profile.assumptions, ...selected.monthlyCost.assumptions] },
    trace: result,
  }
}

export async function createRecommendation(request: RecommendationRequest, dependencies: RecommendationDependencies = { search: searchEvidence }) {
  await ensureCatalog()
  const configuredMaxAge = Number(process.env.EVIDENCE_MAX_AGE_DAYS ?? 90)
  const maxAgeDays = Number.isFinite(configuredMaxAge) ? Math.max(1, Math.min(3_650, configuredMaxAge)) : 90
  const freshAfter = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString()
  const overlays: Record<string, DecisionResult['recommended']['evidence']> = {}
  await Promise.all(architectureCatalog.map(async architecture => {
    const result = await dependencies.search({ architectureId: architecture.id, provider: request.platform, freshAfter, limit: 100 })
    const errors = validateEvidenceSet(result.evidence).filter(issue => issue.severity === 'error')
    if (errors.length) throw new Error(`Search returned invalid evidence for ${architecture.id}`)
    if (result.evidence.some(item => (item.architectureId && item.architectureId !== architecture.id) || (request.platform && item.provider && item.provider !== request.platform))) {
      throw new Error(`Search returned out-of-scope evidence for ${architecture.id}`)
    }
    overlays[architecture.id] = result.evidence
  }))
  return recommendationResponse(runDecisionEngine(request.assessment, request.platform, overlays))
}