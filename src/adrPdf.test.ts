import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildAdrPdf } from './adrPdf'
import { runDecisionEngine, type WorkloadInput } from './domain/decisionEngine'
import { hydrateTestCatalog } from './testCatalog'

hydrateTestCatalog()

const input: WorkloadInput = {
  name: 'Autonomous Travel Planner',
  problem: 'Coordinate specialized travel agents that call external APIs, maintain itinerary state, recover from provider failures, and dynamically re-plan trips.',
  scale: 'Business (500-10K users)',
  aiRequirement: 'Required',
  latency: 'Under 5 seconds',
  sensitivity: 'High / Confidential',
  monthlyRequests: '100K - 250K',
  peakRequestsPerMinute: '100 - 250',
  cloudPreference: 'No preference',
  regulatoryRequirements: ['GDPR'],
  securityRequirements: ['PII Protection'],
  existingTechnology: '',
  integrations: 'Flight, hotel, restaurant, activity, and transportation APIs',
  requiresSourceCitations: null,
  capabilities: ['Multi-agent coordination', 'Durable itinerary state', 'Failure recovery', 'Dynamic re-planning'],
  workloads: ['Travel search', 'Itinerary orchestration'],
  assumptions: ['Travel providers expose supported APIs', 'Users confirm purchases before booking'],
  signals: {
    predictiveScoring: false,
    documentProcessing: false,
    knowledgeRetrieval: false,
    generativeResponse: true,
    toolExecution: true,
    workflowOrchestration: true,
    humanReview: true,
    eventStreaming: false,
    realTime: false,
  },
  potentialCompliance: [],
}

describe('ADR PDF', () => {
  it('builds a paginated PDF for the selected architecture', () => {
    const decision = runDecisionEngine(input, 'AWS')
    const { pdf, filename } = buildAdrPdf(decision, decision.recommended)
    const bytes = new Uint8Array(pdf.output('arraybuffer'))
    const signature = String.fromCharCode(...bytes.slice(0, 4))
    if (process.env.ADR_PDF_OUTPUT) writeFileSync(process.env.ADR_PDF_OUTPUT, bytes)

    expect(signature).toBe('%PDF')
    expect(bytes.byteLength).toBeGreaterThan(20_000)
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(3)
    expect(filename).toBe('autonomous-travel-planner-adr.pdf')
  })
})