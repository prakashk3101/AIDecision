import { describe, expect, it } from 'vitest'
import { hydrateTestCatalog } from './testCatalog'

hydrateTestCatalog()
import { runDecisionEngine, type WorkloadInput } from './domain/decisionEngine'
import { defaultWhatIfScenario, evaluateWhatIfScenario } from './WhatIfSimulator'

const input: WorkloadInput = {
  name: 'Claims assessment',
  problem: 'Process insurance claims with document review and fraud prediction',
  scale: 'Enterprise',
  aiRequirement: 'Required',
  latency: 'Under 2 seconds',
  sensitivity: 'High / Confidential',
  monthlyRequests: '500K - 1M',
  peakRequestsPerMinute: '3,000',
  cloudPreference: 'No preference',
  regulatoryRequirements: ['SOC 2'],
  securityRequirements: [],
  existingTechnology: '',
  integrations: '',
  requiresSourceCitations: null,
  capabilities: [],
  workloads: [],
  assumptions: [],
  signals: {
    predictiveScoring: true,
    documentProcessing: true,
    knowledgeRetrieval: false,
    generativeResponse: false,
    toolExecution: false,
    workflowOrchestration: true,
    humanReview: true,
    eventStreaming: false,
    realTime: false,
  },
  potentialCompliance: [],
}

describe('What-If Simulator', () => {
  const baseline = runDecisionEngine(input)

  it('removes AI requirements and selects a non-AI architecture', () => {
    const scenario = { ...defaultWhatIfScenario(baseline), aiMode: 'No AI' as const }
    const simulation = evaluateWhatIfScenario(baseline, scenario)

    expect(simulation.selected.candidate.id).toBe('traditional')
    expect(simulation.selected.candidate.selectedModel).toBeUndefined()
  })

  it('flags missing latency evidence instead of fabricating a pass or fail', () => {
    const scenario = { ...defaultWhatIfScenario(baseline), latency: 'Under 50 ms' }
    const simulation = evaluateWhatIfScenario(baseline, scenario)

    // Only candidates whose estimate genuinely misses this unrealistic target stay blocked;
    // an estimate that honestly satisfies it is no longer treated as unresolved evidence.
    const blocked = simulation.candidates.filter(item => item.candidate.latencyEstimate.p95Ms > 50)
    expect(blocked.length).toBeGreaterThan(0)
    expect(blocked.every(item => item.candidate.gates.unknownGates.includes('Performance (latency) evidence'))).toBe(true)
    expect(simulation.candidates.every(item => item.candidate.status !== 'eligible')).toBe(true)
  })

  it('prices Azure from official meters without reusing them for AWS', () => {
    const azure = evaluateWhatIfScenario(baseline, { ...defaultWhatIfScenario(baseline), platform: 'Azure' })
    const aws = evaluateWhatIfScenario(baseline, { ...defaultWhatIfScenario(baseline), platform: 'AWS' })

    expect(azure.selected.candidate.platformProvider).toBe('Azure')
    expect(aws.selected.candidate.platformProvider).toBe('AWS')
    expect(aws.selected.candidate.technologies.some(item => item.product.includes('Amazon'))).toBe(true)

    expect(azure.selected.candidate.monthlyCost.available).toBe(true)
    expect(azure.selected.monthlyCost).toBeGreaterThan(0)
    expect(aws.selected.candidate.monthlyCost.available).toBe(false)
    expect(aws.selected.candidate.monthlyCost.missingCategories).toContain('compute')
  })

  it('recalculates availability through the shared decision engine and prices the extra replicas', () => {
    const standard = evaluateWhatIfScenario(baseline, { ...defaultWhatIfScenario(baseline), platform: 'Azure', availability: '99.9%' })
    const critical = evaluateWhatIfScenario(baseline, { ...defaultWhatIfScenario(baseline), platform: 'Azure', availability: '99.999%' })

    expect(critical.result.profile.availabilityTarget).toBe('99.999%')

    // A higher availability target provisions more redundant units, and those units
    // are metered, so the increase is evidence-backed rather than an invented premium.
    expect(critical.selected.monthlyCost).toBeGreaterThan(standard.selected.monthlyCost)
  })

  it('parses 20M traffic and increases variable monthly costs', () => {
    const scenario = evaluateWhatIfScenario(baseline, { ...defaultWhatIfScenario(baseline), platform: 'Azure', monthlyRequests: '20M' })

    expect(scenario.result.profile.monthlyRequestCount).toBe(20_000_000)
    expect(scenario.selected.monthlyCost).toBeGreaterThan(baseline.recommended.monthlyCost.expected)
  })
})