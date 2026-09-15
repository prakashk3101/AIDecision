import { describe, expect, it } from 'vitest'
import { calculateLLMCost, modelCatalog } from '../catalog/modelCatalog'
import { hydrateTestCatalog } from '../testCatalog'
import { optimizeTokenCost, simulateTokenOptimization, type TokenOptimizationInput } from './tokenOptimizationEngine'

hydrateTestCatalog()

function optimizationInput(overrides: Partial<TokenOptimizationInput['requirements']> = {}): TokenOptimizationInput {
  const model = modelCatalog.find(item => item.id === 'azure-gpt-5.6-luna')!
  return {
    usage: { requestsPerMonth: 1_000_000, inputTokensPerRequest: 2_400, outputTokensPerRequest: 600, cachedInputTokensPerRequest: 200 },
    model,
    models: modelCatalog,
    architectureOverheadMs: 900,
    signals: { knowledgeRetrieval: true, generativeResponse: true, toolExecution: true },
    useCase: {
      name: 'Insurance Claims Processing',
      architectureName: 'Agentic Orchestration',
      provider: 'Azure',
      workloads: ['Document processing', 'Fraud investigation', 'Human approval routing'],
      capabilities: ['Knowledge retrieval', 'Tool execution', 'Structured decisions'],
      compliance: ['HIPAA', 'SOC 2'],
      securityRequirements: ['PII Protection', 'Private Networking'],
      latencyLabel: 'Under 15 seconds',
      monthlyRequests: '1M - 5M',
      sensitivity: 'High / Confidential',
    },
    requirements: {
      model: { hostingProvider: 'Azure', requiresImage: false, requiresToolCalling: true, requiresStructuredOutput: true, requiredContextWindow: 32_000, workload: 'agentic' },
      maxLatencyMs: 15_000,
      minimumQuality: 70,
      minimumSecurity: 70,
      minimumReliability: 70,
      functionalRequirementsMet: true,
      securityRequirementsMet: true,
      complianceRequirementsMet: true,
      ...overrides,
    },
  }
}

describe('token optimization engine', () => {
  it('calculates the immutable baseline from requests, input, output, and cached tokens', () => {
    const input = optimizationInput()
    const original = structuredClone(input.usage)
    const result = optimizeTokenCost(input)

    expect(result.baseline.monthlyTokens).toBe(3_000_000_000)
    expect(result.baseline.monthlyCost).toBeCloseTo(calculateLLMCost(input.model, input.usage).total)
    expect(result.baseline.tokens.cachedInputPerRequest).toBe(200)
    expect(input.usage).toEqual(original)
  })

  it('applies combined optimizations sequentially without adding independent savings percentages', () => {
    const result = optimizeTokenCost(optimizationInput())
    const maximum = result.scenarios.find(item => item.name === 'Maximum valid savings')!
    const responseCache = result.scenarios.find(item => item.optimizationIds.length === 1 && item.optimizationIds[0] === 'response-caching')!
    const independentSavings = maximum.optimizationIds.map(id => result.scenarios.find(item => item.optimizationIds.length === 1 && item.optimizationIds[0] === id)?.tokenReductionPercent ?? 0).reduce((sum, value) => sum + value, 0)

    expect(responseCache.tokenReductionPercent).toBe(15)
    expect(maximum.tokens.effectiveRequestsPerMonth).toBe(850_000)
    expect(maximum.tokenReductionPercent).not.toBeCloseTo(independentSavings)
    expect(maximum.monthlyTokens).toBeLessThan(result.baseline.monthlyTokens)
    expect(maximum.monthlyCost).toBeLessThan(result.baseline.monthlyCost)
  })

  it('simulates a user-selected optimization combination against an unchanged baseline', () => {
    const input = optimizationInput()
    const baseline = optimizeTokenCost(input).baseline
    const custom = simulateTokenOptimization(input, ['rag-context', 'prompt-caching', 'rag-context'])

    expect(custom.optimizationIds).toEqual(['rag-context', 'prompt-caching'])
    expect(custom.tokens.ragContextPerRequest).toBeLessThan(baseline.tokens.ragContextPerRequest)
    expect(custom.tokens.cachedInputPerRequest).toBeGreaterThan(baseline.tokens.cachedInputPerRequest)
    expect(custom.monthlyCost).toBeLessThan(baseline.monthlyCost)
    expect(optimizeTokenCost(input).baseline).toEqual(baseline)
  })

  it('rejects scenarios that violate hard latency or quality requirements', () => {
    const result = optimizeTokenCost(optimizationInput({ maxLatencyMs: 1_000, minimumQuality: 95 }))

    expect(result.scenarios.every(item => !item.valid)).toBe(true)
    expect(result.scenarios.some(item => item.rejectionReasons.some(reason => reason.includes('latency')))).toBe(true)
    expect(result.scenarios.some(item => item.rejectionReasons.some(reason => reason.includes('Quality')))).toBe(true)
    expect(result.recommended).toBeNull()
  })

  it('ranks valid scenarios and explains baseline to optimization impact', () => {
    const result = optimizeTokenCost(optimizationInput())

    expect(result.opportunities.map(item => item.id)).toEqual(expect.arrayContaining(['rag-context', 'conversation-history', 'output-size', 'prompt-caching', 'response-caching', 'agent-calls', 'tool-calls', 'duplicate-context', 'model-selection']))
    expect(result.opportunities.find(item => item.id === 'rag-context')?.useCaseFit).toContain('Insurance Claims Processing')
    expect(result.opportunities.find(item => item.id === 'rag-context')?.useCaseFit).toContain('Document processing')
    expect(result.opportunities.find(item => item.id === 'model-selection')?.nfrAlignment).toContain('quality')
    expect(result.recommended).not.toBeNull()
    expect(result.recommended?.valid).toBe(true)
    expect(result.recommended?.score).toBeGreaterThan(0)
    expect(result.recommended?.explanation).toContain('fewer tokens')
    expect(result.recommended?.useCaseAlignment.length).toBeGreaterThan(0)
    expect(result.recommended?.useCaseAlignment.join(' ')).toContain('Insurance Claims Processing')
    expect(result.recommended?.nfrAlignment).toMatch(/latency|quality|security|reliability/i)
    expect(result.recommended?.selectionGuidance).toContain('Choose')
    expect(result.scenarios[0]).toBe(result.recommended)
  })
})
