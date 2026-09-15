import { useState } from 'react'
import { Check, CircleDollarSign, Gauge, ShieldCheck, Sparkles, TriangleAlert, Zap } from 'lucide-react'
import { modelCatalog, type TokenUsage } from './catalog/modelCatalog'
import { modelRequirementsFor, type DecisionResult } from './domain/decisionEngine'
import { optimizeTokenCost, simulateTokenOptimization, type OptimizationId, type OptimizationScenario, type TokenOptimizationInput } from './cost/tokenOptimizationEngine'

type Props = {
  decision: DecisionResult
  onApply: (scenario: OptimizationScenario, usage: TokenUsage) => void
}

const money = (value: number) => `$${Math.round(value).toLocaleString()}`
const compact = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const inputTokens = (scenario: OptimizationScenario) => scenario.tokens.baseInputPerRequest + scenario.tokens.ragContextPerRequest + scenario.tokens.conversationHistoryPerRequest + scenario.tokens.agentToolPerRequest + scenario.tokens.duplicateContextPerRequest

export default function TokenOptimization({ decision, onApply }: Props) {
  const [selectedIds, setSelectedIds] = useState<OptimizationId[]>([])
  const candidate = decision.recommended
  const model = candidate.selectedModel && modelCatalog.find(item => item.id === candidate.selectedModel?.id)
  if (!model) return <section className="workspace token-optimization-workspace"><div className="token-optimization-empty"><Zap size={24} /><h1>No LLM token workload</h1><p>The selected architecture does not require a generative model, so token optimization does not apply.</p></div></section>

  const optimizationInput: TokenOptimizationInput = {
    usage: decision.profile.tokenUsage,
    model,
    models: modelCatalog,
    architectureOverheadMs: candidate.latencyEstimate.overheadMs,
    useCase: {
      name: decision.profile.name,
      architectureName: candidate.name,
      provider: candidate.platformProvider,
      workloads: decision.profile.workloads,
      capabilities: decision.profile.capabilities,
      compliance: decision.profile.compliance,
      securityRequirements: decision.profile.securityRequirements,
      latencyLabel: decision.profile.latency,
      monthlyRequests: decision.profile.monthlyRequests,
      sensitivity: decision.profile.sensitivity,
    },
    signals: {
      knowledgeRetrieval: decision.profile.signals.knowledgeRetrieval,
      generativeResponse: decision.profile.signals.generativeResponse,
      toolExecution: decision.profile.signals.toolExecution,
    },
    requirements: {
      model: modelRequirementsFor(decision.profile, candidate.platformProvider),
      maxLatencyMs: decision.profile.latencySlaMs,
      minimumQuality: 70,
      minimumSecurity: 70,
      minimumReliability: 70,
      functionalRequirementsMet: candidate.gates.failedGates.length === 0,
      securityRequirementsMet: candidate.evaluations.security.missingControls.length === 0,
      complianceRequirementsMet: !candidate.gates.failedGates.some(item => /compliance/i.test(item)),
    },
  }
  const result = optimizeTokenCost(optimizationInput)
  const recommended = result.recommended
  const custom = selectedIds.length ? simulateTokenOptimization(optimizationInput, selectedIds) : null
  const activeScenario = custom ?? recommended
  const toggle = (id: OptimizationId) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const apply = () => {
    if (!activeScenario?.valid) return
    onApply(activeScenario, {
      requestsPerMonth: activeScenario.tokens.effectiveRequestsPerMonth,
      inputTokensPerRequest: inputTokens(activeScenario),
      outputTokensPerRequest: activeScenario.tokens.outputPerRequest,
      cachedInputTokensPerRequest: activeScenario.tokens.cachedInputPerRequest,
    })
  }

  return <section className="workspace token-optimization-workspace">
    <header className="token-optimization-header"><div><span>TOKEN & COST OPTIMIZATION</span><h1>Optimize model usage</h1><p>Preserve the baseline, apply changes sequentially, recalculate every scenario, reject constraint violations, and rank valid options.</p></div><div className="token-baseline-model"><small>BASELINE MODEL</small><strong>{model.name}</strong><span>{candidate.platformProvider} · {decision.profile.requirements.genAI ? 'Generative AI' : 'AI workload'}</span></div></header>

    <section className="token-baseline-grid">
      <article><span><Zap size={18} /></span><div><small>MONTHLY TOKENS</small><strong>{compact(result.baseline.monthlyTokens)}</strong><p>{compact(result.baseline.tokens.effectiveRequestsPerMonth)} requests</p></div></article>
      <article><span><CircleDollarSign size={18} /></span><div><small>BASELINE MODEL COST</small><strong>{money(result.baseline.monthlyCost)}</strong><p>Published input, cached, and output prices</p></div></article>
      <article><span><Gauge size={18} /></span><div><small>ESTIMATED LATENCY</small><strong>{result.baseline.latencyMs.toLocaleString()}ms</strong><p>Target {decision.profile.latencySlaMs.toLocaleString()}ms</p></div></article>
      <article><span><ShieldCheck size={18} /></span><div><small>HARD REQUIREMENTS</small><strong>{result.baseline.valid ? 'Baseline valid' : 'Review required'}</strong><p>Functional, security, quality, compliance</p></div></article>
    </section>

    <section className="token-opportunity-panel"><div className="token-section-heading"><Sparkles size={19} /><div><h2>Select Optimizations</h2><p>Choose one or more opportunities. Results recalculate sequentially against the unchanged baseline.</p></div>{selectedIds.length > 0 && <button className="token-clear-selection" onClick={() => setSelectedIds([])}>Clear selection</button>}</div><div className="token-opportunity-grid">{result.opportunities.map(item => { const selected = selectedIds.includes(item.id); return <button type="button" aria-pressed={selected} className={selected ? 'selected' : ''} onClick={() => toggle(item.id)} key={item.id}><span className="token-opportunity-check">{selected ? <Check size={15} /> : null}</span><strong>{item.label}</strong><p>{item.explanation}</p><div className="token-opportunity-fit"><span><b>Use case</b>{item.useCaseFit}</span><span><b>NFR</b>{item.nfrAlignment}</span></div><footer><span>{item.risk} risk</span><span>Quality −{item.qualityImpact}</span><span>Complexity +{item.complexityImpact}</span></footer></button> })}</div></section>

    {activeScenario ? <section className={`token-recommendation ${activeScenario.valid ? '' : 'rejected'}`}><div><small>{custom ? 'YOUR INTERACTIVE SCENARIO' : 'RECOMMENDED VALID SCENARIO'}</small><h2>{custom ? `${selectedIds.length} optimization${selectedIds.length === 1 ? '' : 's'} selected` : activeScenario.name}</h2><p>{activeScenario.explanation}</p><div className="token-scenario-fit"><span><b>Use case fit</b>{activeScenario.useCaseAlignment[0]}</span><span><b>NFR guardrail</b>{activeScenario.nfrAlignment}</span><span><b>Choose when</b>{activeScenario.selectionGuidance}</span></div>{!activeScenario.valid && <em>{activeScenario.rejectionReasons.join(' · ')}</em>}</div><dl><div><dt>Token reduction</dt><dd>{activeScenario.tokenReductionPercent}%</dd></div><div><dt>Cost reduction</dt><dd>{activeScenario.costReductionPercent}%</dd></div><div><dt>New model cost</dt><dd>{money(activeScenario.monthlyCost)}</dd></div><div><dt>Latency / quality</dt><dd>{activeScenario.latencyMs.toLocaleString()}ms / {activeScenario.quality}</dd></div></dl><button disabled={!activeScenario.valid} onClick={apply}>{activeScenario.valid ? <><Check size={17} /> Apply {custom ? 'selection' : 'recommendation'}</> : <><TriangleAlert size={17} /> Requirements violated</>}</button></section> : <section className="token-recommendation rejected"><TriangleAlert size={20} /><div><h2>No valid optimization scenario</h2><p>Every generated scenario violates at least one hard requirement. Keep the baseline or adjust requirements.</p></div></section>}

    <section className="token-scenario-panel"><div className="token-section-heading"><Gauge size={19} /><div><h2>Ranked Scenarios</h2><p>Valid scenarios rank first by score, confidence, and unnecessary cost.</p></div></div><div className="token-scenario-table"><table><thead><tr><th>Scenario</th><th>Status</th><th>Tokens</th><th>Cost</th><th>Token reduction</th><th>Cost reduction</th><th>Latency</th><th>Quality</th><th>Risk</th><th>Score</th></tr></thead><tbody>{result.scenarios.map(scenario => <tr key={scenario.id} className={scenario === recommended ? 'recommended' : scenario.valid ? '' : 'rejected'}><td><strong>{scenario.name}</strong><small>{scenario.explanation}</small><small><b>Fit:</b> {scenario.useCaseAlignment[0]}</small><small><b>NFR:</b> {scenario.nfrAlignment}</small>{!scenario.valid && <em>{scenario.rejectionReasons.join(' · ')}</em>}</td><td><span>{scenario.valid ? 'Valid' : 'Rejected'}</span></td><td>{compact(scenario.monthlyTokens)}</td><td>{money(scenario.monthlyCost)}</td><td>{scenario.tokenReductionPercent}%</td><td>{scenario.costReductionPercent}%</td><td>{scenario.latencyMs.toLocaleString()}ms</td><td>{scenario.quality}</td><td>{scenario.risk}</td><td><b>{scenario.score}</b></td></tr>)}</tbody></table></div></section>
  </section>
}
