import type { ArchitectureCatalogEntry } from '../catalog/architectureCatalog.js'

export type RequirementGateProfile = {
  requiresAI: boolean
  requiresMultimodal: boolean
  requiresToolCalling: boolean
  requiresHumanReview: boolean
  requiresSourceCitations: boolean | null
  problem: string
  signals: {
    predictiveScoring: boolean
    documentProcessing: boolean
    knowledgeRetrieval: boolean
    workflowOrchestration: boolean
  }
}

export function requirementGateFailures(profile: RequirementGateProfile, architecture: ArchitectureCatalogEntry) {
  const failures: string[] = []
  const requiresEventStreaming = /\b(event[- ]driven|event stream(?:ing)?|streaming events?|continuous event stream)\b/i.test(profile.problem)
  if (profile.requiresAI && !architecture.capabilities.ai) failures.push('Mandatory AI capability is not supported')
  if (profile.requiresMultimodal && !architecture.capabilities.multimodal) failures.push('Mandatory multimodal processing is not supported')
  if (profile.requiresToolCalling && !architecture.capabilities.toolCalling) failures.push('Mandatory tool calling is not supported')
  if (profile.requiresHumanReview && !architecture.capabilities.humanReview) failures.push('Mandatory human approval is not supported')
  if (profile.requiresSourceCitations === true && !architecture.capabilities.sourceCitations) failures.push('Mandatory source citations are not supported')
  if (profile.signals.predictiveScoring && !architecture.capabilities.predictiveScoring) failures.push('Mandatory predictive scoring is not supported')
  if (profile.signals.documentProcessing && !architecture.capabilities.documentProcessing) failures.push('Mandatory document processing is not supported')
  if (profile.signals.knowledgeRetrieval && !architecture.capabilities.knowledgeRetrieval) failures.push('Mandatory knowledge retrieval is not supported')
  if (profile.signals.workflowOrchestration && !architecture.capabilities.workflowOrchestration) failures.push('Mandatory workflow orchestration is not supported')
  if (requiresEventStreaming && !architecture.capabilities.streaming) failures.push('Mandatory event streaming is not supported')
  return failures
}