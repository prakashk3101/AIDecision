import { describe, expect, it } from 'vitest'
import { calculateLLMCost, evaluateModels, modelCatalog } from '../catalog/modelCatalog'
import { applySelectedModel, buildWorkloadProfile, modelRequirementsFor, runDecisionEngine, type WorkloadInput } from './decisionEngine'
import { hydrateTestCatalog } from '../testCatalog'

hydrateTestCatalog()

const workload = (overrides: Partial<WorkloadInput> = {}): WorkloadInput => ({
  name: 'Regression workload',
  problem: 'Process business transactions',
  scale: 'Business',
  aiRequirement: 'Let AI Determine',
  latency: 'Under 3 seconds',
  sensitivity: 'Standard / Internal',
  monthlyRequests: '100,000',
  peakRequestsPerMinute: '3,000',
  cloudPreference: 'No preference',
  regulatoryRequirements: [],
  securityRequirements: [],
  existingTechnology: '',
  integrations: '',
  requiresSourceCitations: null,
  capabilities: [],
  workloads: [],
  assumptions: [],
  signals: {
    predictiveScoring: false,
    documentProcessing: false,
    knowledgeRetrieval: false,
    generativeResponse: false,
    toolExecution: false,
    workflowOrchestration: false,
    humanReview: false,
    eventStreaming: false,
    realTime: false,
  },
  potentialCompliance: [],
  ...overrides,
})

describe('decision engine', () => {
  it('selects event-driven ML for real-time fraud scoring', () => {
    const decision = runDecisionEngine(workload({ problem: 'Real-time fraud prediction over a continuous event stream', scale: 'Enterprise', aiRequirement: 'Required', latency: 'Under 500ms', signals: { ...workload().signals, predictiveScoring: true, eventStreaming: true, realTime: true } }))
    expect(decision.recommended.id).toBe('event-ml')
    expect(decision.candidates.find(candidate => candidate.id === 'agentic')?.rejectionReasons).toContain('Mandatory event streaming is not supported')
  })

  it('selects event-driven ML for bank fraud scoring without explicit agent work', () => {
    const decision = runDecisionEngine(workload({
      name: 'Bank Transaction Fraud Detection',
      problem: 'Detect fraudulent transactions by analyzing transaction patterns, customer behavior, transaction history, location, and device signals, then explain why a transaction was flagged.',
      scale: 'Enterprise',
      aiRequirement: 'Required',
      latency: 'Under 3 seconds',
      sensitivity: 'Mission Critical / Restricted',
      capabilities: ['Fraud detection', 'Explainable risk score'],
      workloads: ['Transaction pattern classification', 'Customer behavior analysis'],
    }))

    expect(decision.profile.signals.predictiveScoring).toBe(true)
    expect(decision.profile.requiresToolCalling).toBe(false)
    expect(decision.profile.requiresGenAI).toBe(false)
    expect(decision.recommended.id).toBe('event-ml')
  })

  it('selects RAG for a cited knowledge assistant', () => {
    const decision = runDecisionEngine(workload({ problem: 'Enterprise knowledge assistant over governed documents', aiRequirement: 'Required', requiresSourceCitations: true, signals: { ...workload().signals, knowledgeRetrieval: true, generativeResponse: true } }), 'Azure')
    expect(decision.recommended.id).toBe('rag')
    expect(decision.recommended.selectedModel).toBeDefined()
    expect(decision.recommended.selectedModel?.monthlyCost).toBeGreaterThan(0)
    expect(decision.recommended.monthlyCost.breakdown.Search).toBeCloseTo(162.206)
  })

  it('exposes the same model ranking used by the architecture recommendation', () => {
    const decision = runDecisionEngine(workload({ problem: 'Enterprise knowledge assistant over governed documents', aiRequirement: 'Required', requiresSourceCitations: true, signals: { ...workload().signals, knowledgeRetrieval: true, generativeResponse: true } }))
    const ranking = evaluateModels(modelRequirementsFor(decision.profile, decision.recommended.platformProvider), decision.profile.tokenUsage)

    expect(ranking.find(model => model.eligible)?.model.id).toBe(decision.recommended.selectedModel?.id)
  })

  it('applies a Cost Analysis model choice to model identity, technology, and monthly cost', () => {
    const decision = runDecisionEngine(workload({ problem: 'Enterprise knowledge assistant over governed documents', aiRequirement: 'Required', requiresSourceCitations: true, signals: { ...workload().signals, knowledgeRetrieval: true, generativeResponse: true } }), 'Azure')
    const alternatives = evaluateModels(modelRequirementsFor(decision.profile, 'Azure'), decision.profile.tokenUsage).filter(item => item.eligible)
    const alternative = alternatives.find(item => item.model.id !== decision.recommended.selectedModel?.id)!
    const selected = applySelectedModel(decision.recommended, decision.profile, alternative.model.id)

    expect(selected.selectedModel?.id).toBe(alternative.model.id)
    expect(selected.selectedModel?.monthlyCost).toBe(alternative.monthlyCost)
    expect(selected.monthlyCost.breakdown.Ai).toBeCloseTo(alternative.monthlyCost)
    expect(selected.monthlyCost.expected).not.toBe(decision.recommended.monthlyCost.expected)
    expect(selected.technologies.find(item => /^(LLM|LLM Model|AI Model|AI Enrichment)$/.test(item.component))?.product).toBe(alternative.model.name)
  })

  it('selects agentic orchestration for autonomous tool use', () => {
    const decision = runDecisionEngine(workload({ problem: 'Autonomous agent performs multi-step work and tool calls with human approval', aiRequirement: 'Required', latency: 'Under 5 seconds', signals: { ...workload().signals, toolExecution: true, workflowOrchestration: true, humanReview: true } }))
    expect(decision.recommended.id).toBe('agentic')
  })

  it('keeps scalable agentic orchestration eligible for hosted agent orchestration', () => {
    const decision = runDecisionEngine(workload({
      problem: 'Host an agent orchestration framework in independently scalable microservices with governed tool calls and human approval',
      aiRequirement: 'Required',
      latency: 'Under 15 seconds',
      signals: { ...workload().signals, toolExecution: true, workflowOrchestration: true, humanReview: true },
    }), 'Azure')
    const microservices = decision.candidates.find(candidate => candidate.id === 'microservices-ai')!

    expect(microservices.status).toBe('eligible')
    expect(microservices.rejectionReasons).not.toContain('Mandatory tool calling is not supported')
    expect(microservices.technologies.find(item => item.component === 'Agent Orchestrator')?.product).toBe('Microsoft Foundry Agent Service')
    expect(microservices.technologies.find(item => item.component === 'Tool Gateway')?.product).toBe('Azure API Management')
  })

  it('calculates different infrastructure costs for different architecture topologies', () => {
    const decision = runDecisionEngine(workload({
      problem: 'Autonomous agent performs multi-step work and tool calls with human approval',
      aiRequirement: 'Required',
      latency: 'Under 15 seconds',
      signals: { ...workload().signals, toolExecution: true, workflowOrchestration: true, humanReview: true },
    }), 'Azure')
    const costs = decision.candidates.map(candidate => candidate.monthlyCost.expected)

    expect(new Set(costs).size).toBeGreaterThan(3)
    expect(decision.candidates.find(candidate => candidate.id === 'microservices-ai')?.monthlyCost.expected)
      .not.toBe(decision.candidates.find(candidate => candidate.id === 'agentic')?.monthlyCost.expected)
  })

  it('keeps agentic orchestration eligible when travel replanning is misclassified as event streaming', () => {
    const decision = runDecisionEngine(workload({
      problem: 'Build an autonomous travel-planning system where multiple specialized agents search travel APIs, communicate, maintain state, recover from failures, and dynamically re-plan based on user preferences.',
      scale: 'Enterprise (50K+ users)',
      aiRequirement: 'Let AI Determine',
      latency: 'Under 2 seconds',
      signals: { ...workload().signals, toolExecution: true, workflowOrchestration: true, humanReview: true, eventStreaming: true, realTime: true },
    }))

    expect(decision.recommended.id).toBe('agentic')
    expect(decision.recommended.status).toBe('partiallyEligible')
    expect(decision.recommended.gates.unknownGates).toContain('Performance (latency) evidence')
  })

  it('selects a traditional architecture when AI is not required', () => {
    const decision = runDecisionEngine(workload({ aiRequirement: 'Not Required' }))
    expect(decision.recommended.id).toBe('traditional')
    expect(decision.recommended.selectedModel).toBeUndefined()
  })

  it('selects hybrid processing when prediction, documents, workflow, and review are all required', () => {
    const decision = runDecisionEngine(workload({
      problem: 'Process insurance claim documents, detect fraud, and route complex claims for human approval',
      scale: 'Enterprise',
      aiRequirement: 'Required',
      latency: 'Under 2 seconds',
      signals: { ...workload().signals, predictiveScoring: true, documentProcessing: true, workflowOrchestration: true, humanReview: true },
    }))
    expect(decision.recommended.id).toBe('hybrid')
  })

  it('estimates microservices costs from available official same-unit prices', () => {
    const input = workload({
      problem: 'Host containerized domain services for event-driven workflows and governed AI responses',
      scale: 'Enterprise',
      aiRequirement: 'Required',
      existingTechnology: 'Docker containers and Kubernetes',
      signals: { ...workload().signals, generativeResponse: true, workflowOrchestration: true, eventStreaming: true },
    })
    const decision = runDecisionEngine(input, 'Azure')
    const candidate = decision.candidates.find(item => item.id === 'microservices-ai')!

    expect(candidate).toBeDefined()
    expect(candidate.status).toBe('partiallyEligible')
    expect(candidate.complexityPenalty).toBeGreaterThan(50)
    expect(candidate.monthlyCost.available).toBe(true)
    expect(candidate.monthlyCost.expected).toBeGreaterThan(0)
    expect(candidate.monthlyCost.breakdown.Compute).toBeGreaterThan(0)
    expect(candidate.monthlyCost.missingCategories).toEqual([])

    const runtimes = { Azure: 'Azure Container Apps', AWS: 'Amazon ECS', 'Google Cloud': 'Cloud Run', 'Open source': 'Kubernetes' }
    for (const [provider, product] of Object.entries(runtimes)) {
      const platformDecision = runDecisionEngine(input, provider)
      const platformCandidate = platformDecision.candidates.find(item => item.id === 'microservices-ai')!
      expect(platformCandidate.technologies.find(technology => technology.component === 'Microservices Runtime')?.product).toBe(product)
    }
  })

  it('keeps inferred compliance separate from explicit requirements', () => {
    const profile = buildWorkloadProfile(workload({ problem: 'Process patient health records', potentialCompliance: ['HIPAA', 'PII'] }))
    expect(profile.compliance).toEqual([])
    expect(profile.suggestedCompliance).toEqual(expect.arrayContaining(['HIPAA', 'PII']))
  })

  it('reaches eligible when every requirement is measured, met, or estimated within target', () => {
    const decision = runDecisionEngine(workload())
    expect(decision.recommendations.bestOverall).toBe(decision.recommended)
    expect(decision.recommendations.lowestCost.monthlyCost.expected).toBeLessThanOrEqual(decision.recommended.monthlyCost.expected)
    expect(decision.recommended.status).toBe('eligible')
    expect(decision.reasons[0]).toContain('Passes every mandatory requirement gate with complete evidence')
  })

  it('recomputes technologies and costs for an explicitly selected platform', () => {
    const azure = runDecisionEngine(workload({ aiRequirement: 'Required', signals: { ...workload().signals, toolExecution: true, workflowOrchestration: true } }), 'Azure')
    const aws = runDecisionEngine(workload({ aiRequirement: 'Required', signals: { ...workload().signals, toolExecution: true, workflowOrchestration: true } }), 'AWS')

    expect(aws.platformOverride).toBe('AWS')
    expect(aws.candidates.every(candidate => candidate.platformProvider === 'AWS')).toBe(true)
    expect(aws.recommended.technologies.some(technology => technology.product.includes('Amazon'))).toBe(true)
    expect(aws.recommended.monthlyCost.available).toBe(false)
    expect(aws.recommended.monthlyCost.missingCategories).toContain('compute')
    // Azure retail prices have been collected for every estimated resource category.
    expect(azure.recommended.monthlyCost.available).toBe(true)
    expect(azure.recommended.monthlyCost.expected).toBeGreaterThan(0)
  })

  it('surfaces expected monthly cost even when no budget gate is supplied', () => {
    const decision = runDecisionEngine(workload(), 'Azure')
    const cost = decision.recommended.requirementFit.find(item => item.requirement === 'Expected monthly cost')

    expect(cost).toBeDefined()
    expect(cost?.status).toBe('met')
    expect(cost?.explanation).toContain('Expected monthly cost is $')
    expect(decision.recommended.gates.unknownGates).not.toContain('Monthly cost evidence')
  })

  it('uses explicit peak traffic instead of converting user scale into throughput', () => {
    const profile = buildWorkloadProfile(workload({ scale: 'Enterprise', peakRequestsPerMinute: '100 - 250' }))
    expect(profile.peakRequestsPerSecond).toBeCloseTo(175 / 60)
    expect(profile.requirements.throughputRps).toBe(profile.peakRequestsPerSecond)
    expect(profile.requirements.latencyMs).toBe(profile.latencySlaMs)
    expect(profile.requirements.availabilityPercent).toBe(99.9)
  })

  it('selects RAG for a Microsoft 365 HR assistant without adding ML or event streaming', () => {
    const decision = runDecisionEngine(workload({
      name: 'HR Assistant',
      problem: 'Build an AI assistant for 5,000 employees that answers HR questions using internal SharePoint policies, benefits and employee documentation. The assistant should use RAG, support Microsoft 365 users, and guide employees through common HR requests. Sensitive requests should require human approval. The solution should be easy for business users to maintain, secure, and cost-effective, with no requirement for complex multi-agent orchestration.',
      scale: 'Business (500-10K users)',
      aiRequirement: 'Required',
      existingTechnology: 'Microsoft 365, SharePoint',
      integrations: 'SharePoint, Microsoft 365',
      signals: { ...workload().signals, knowledgeRetrieval: true, generativeResponse: true, humanReview: true },
    }))
    expect(decision.recommended.id).toBe('rag')
    expect(decision.recommended.technologies.map(item => item.component)).not.toEqual(expect.arrayContaining(['ML Service', 'ML Inference', 'Event Stream']))
    expect(decision.recommended.technologies.every(item => item.functionalRequirement.length > 0 && item.nonFunctionalRequirement.length > 0)).toBe(true)
    expect(decision.recommended.technologies.find(item => item.component === 'Search Index')?.functionalRequirement).toContain('Retrieve')
    expect(decision.tradeOffs.length).toBeGreaterThan(0)
    expect(decision.tradeOffs.every(item => item.dimension.length > 0 && item.selected.length > 0 && item.rationale.length > 0 && item.sacrifice.length > 0 && item.alternative.length > 0)).toBe(true)
    expect(decision.tradeOffs.every(item => item.selected === decision.recommended.name && item.alternative !== item.selected)).toBe(true)
  })

  it('does not derive predictive scoring from failure recovery or option ranking', () => {
    const profile = buildWorkloadProfile(workload({
      problem: 'Autonomous travel planning across flights, hotels, restaurants, activities and transportation.',
      capabilities: ['Multi-agent coordination', 'Failure detection and recovery', 'Preference scoring and option ranking', 'Dynamic re-planning'],
      workloads: ['Travel search', 'Itinerary orchestration'],
    }))

    expect(profile.signals.predictiveScoring).toBe(false)
    expect(profile.signals.toolExecution).toBe(true)
    expect(profile.signals.workflowOrchestration).toBe(true)
  })

  it('still derives predictive scoring from machine-learning capability phrases', () => {
    const profile = buildWorkloadProfile(workload({
      capabilities: ['Computer vision defect detection', 'GPU-accelerated deployment'],
      workloads: ['Defect classification and anomaly detection'],
    }))

    expect(profile.signals.predictiveScoring).toBe(true)
  })

  it('derives agentic and generative signals for multi-source travel itinerary planning without literal agent/workflow wording', () => {
    const decision = runDecisionEngine(workload({
      name: 'Travel Itinerary Planner',
      problem: "A travel company wants to use AI to create personalized end-to-end travel plans based on a customer's destination, travel dates, budget, interests, preferred activities, and travel preferences. The system searches and combines flights, hotels, sightseeing activities, restaurants, and transportation options to create and continuously refine a complete travel itinerary.",
      aiRequirement: 'Let AI Determine',
      capabilities: [
        'Personalized travel itinerary generation',
        'Multi-source travel option search and aggregation',
        'Constraint-based itinerary optimization',
        'Continuous itinerary refinement',
        'Preference and budget-aware recommendation',
        'End-to-end trip planning across flight, lodging, activity, dining, and ground transport',
      ],
      workloads: [
        'Travel itinerary planning',
        'Flight and hotel search integration',
        'Activities and dining recommendation',
        'Transportation option planning',
        'Itinerary update and refinement',
      ],
    }))

    expect(decision.profile.signals.toolExecution).toBe(true)
    expect(decision.profile.signals.workflowOrchestration).toBe(true)
    expect(decision.profile.signals.generativeResponse).toBe(true)
    expect(decision.recommended.id).not.toBe('event-ml')
  })

  it('resolves PII protection from provider documentation and leaves unverified controls unknown', () => {
    const decision = runDecisionEngine(workload({ sensitivity: 'High / Confidential', securityRequirements: ['PII Protection'] }), 'Azure')
    const candidate = decision.recommended
    const pii = candidate.requirementFit.find(item => item.requirement === 'Security control: PII Protection')!
    const encryption = candidate.requirementFit.find(item => item.requirement === 'Security control: Encryption at rest')!

    expect(pii.status).toBe('met')
    expect(candidate.evidence.some(item => item.metric === 'security.piiProtection' && item.sourceType === 'official-documentation')).toBe(true)
    expect(encryption.status).toBe('unknown')
    expect(candidate.gates.failedGates).not.toContain('Missing mandatory security controls: encryptionAtRest')
  })

  it('composes architecture latency from platform overhead plus the selected model', () => {
    const decision = runDecisionEngine(workload({ problem: 'Enterprise knowledge assistant over governed documents', aiRequirement: 'Required', requiresSourceCitations: true, signals: { ...workload().signals, knowledgeRetrieval: true, generativeResponse: true } }))
    const rag = decision.candidates.find(candidate => candidate.id === 'rag')!
    const model = modelCatalog.find(item => item.id === rag.selectedModel!.id)!

    expect(rag.latencyEstimate.overheadMs).toBe(245)
    expect(rag.latencyEstimate.modelTtftMs).toBe(model.latency.ttftMs)
    expect(rag.latencyEstimate.outputTokens).toBe(decision.profile.tokenUsage.outputTokensPerRequest)
    expect(rag.latencyEstimate.modelDecodeMs).toBe(Math.round(rag.latencyEstimate.outputTokens / model.latency.outputTokensPerSecond * 1000))
    expect(rag.latencyEstimate.p95Ms).toBe(rag.latencyEstimate.overheadMs + rag.latencyEstimate.modelMs!)
    expect(rag.latencyEstimate.breakdown.at(-1)?.name).toContain('tok/s')
  })

  it('leaves the model term out of architectures without an inference step', () => {
    const decision = runDecisionEngine(workload({ aiRequirement: 'Not Required' }))
    const traditional = decision.candidates.find(candidate => candidate.id === 'traditional')!

    expect(traditional.selectedModel).toBeUndefined()
    expect(traditional.latencyEstimate.p95Ms).toBe(80)
    expect(traditional.latencyEstimate.modelMs).toBeNull()
  })

  it('reports the composed estimate as an estimate rather than a measurement, without blocking an in-target estimate', () => {
    const decision = runDecisionEngine(workload({ aiRequirement: 'Not Required' }))
    const traditional = decision.candidates.find(candidate => candidate.id === 'traditional')!
    const latencyFit = traditional.requirementFit.find(item => item.requirement.startsWith('Latency'))!

    expect(traditional.gates.unknownGates).not.toContain('Performance (latency) evidence')
    expect(latencyFit.status).toBe('unknown')
    expect(latencyFit.indicator).toBe('met')
    expect(latencyFit.explanation).toBe(`Estimated ${traditional.latencyEstimate.p95Ms}ms (within target, not measured)`)
    expect(traditional.status).toBe('eligible')
  })
})

describe('model pricing', () => {
  it('calculates input and output token costs from catalog pricing', () => {
    const model = modelCatalog.find(item => item.id === 'azure-gpt-5.4-mini')!
    const cost = calculateLLMCost(model, { requestsPerMonth: 1_000, inputTokensPerRequest: 1_000, outputTokensPerRequest: 100 })
    expect(cost.inputCost).toBeCloseTo(.75)
    expect(cost.outputCost).toBeCloseTo(.45)
    expect(cost.total).toBeCloseTo(1.2)
  })
})