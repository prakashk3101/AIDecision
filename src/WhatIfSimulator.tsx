import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Gauge, Play, RefreshCw, ShieldCheck, Waypoints, X } from 'lucide-react'
import { platformOptions, runDecisionEngine, type DecisionResult, type EvaluatedCandidate, type WorkloadInput } from './domain/decisionEngine'

type Props = {
  decision: DecisionResult
  onClose: () => void
  onScenarioApply?: (scenario: WhatIfScenario) => void
}

type AiMode = 'No AI' | 'Predictive ML' | 'GenAI' | 'RAG' | 'Agentic AI'

export type WhatIfScenario = {
  latency: string
  monthlyRequests: string
  aiMode: AiMode
  sensitivity: string
  compliance: string[]
  availability: string
  platform: string
}

type SimulationCandidate = {
  candidate: EvaluatedCandidate
  monthlyCost: number
  blockingReasons: string[]
}

const latencyOptions = ['Under 50 ms', 'Under 500 ms', 'Under 2 seconds', 'Under 3 seconds', 'Under 5 seconds', 'More than 5 seconds']
const trafficOptions = ['Under 100K', '100K - 250K', '250K - 500K', '500K', '1M', '3M', '5M', '10M', '15M', '20M']
const sensitivityOptions = ['Standard / Internal', 'High / Confidential', 'Mission Critical / Restricted']
const complianceOptions = ['PCI DSS', 'GDPR', 'HIPAA', 'SOC 2', 'ISO 27001', 'FedRAMP']
const availabilityOptions = ['99.9%', '99.95%', '99.99%', '99.999%']
const statusText = (status: EvaluatedCandidate['status']) => status === 'eligible' ? 'Eligible' : status === 'partiallyEligible' ? 'Partially eligible' : 'Not eligible'

const money = (value: number) => Number.isFinite(value) ? `$${Math.round(value).toLocaleString()}` : 'Unavailable'
const moneyDetailed = (value: number) => !Number.isFinite(value) ? 'Unavailable' : value === 0 ? '$0.00' : value < 100 ? `$${value.toFixed(2)}` : money(value)
const latencyValue = (value: number) => Number.isFinite(value) ? `${value} ms` : 'Unavailable'
const latencyTarget = (value: string) => value.includes('50 ms') ? 50 : value.includes('500') ? 500 : value.includes('2 seconds') ? 2_000 : value.includes('3 seconds') ? 3_000 : value.includes('5 seconds') ? 5_000 : 10_000
const architectureComponents = (candidate: EvaluatedCandidate) => candidate.technologies.slice(0, 5).map(item => item.component).join(' + ')

function inferAiMode(input: WorkloadInput): AiMode {
  if (input.aiRequirement === 'Not Required') return 'No AI'
  if (input.signals.toolExecution) return 'Agentic AI'
  if (input.signals.knowledgeRetrieval) return 'RAG'
  if (input.signals.generativeResponse) return 'GenAI'
  if (input.signals.predictiveScoring) return 'Predictive ML'
  return input.aiRequirement === 'Required' ? 'GenAI' : 'No AI'
}

function scenarioInput(base: WorkloadInput, scenario: WhatIfScenario): WorkloadInput {
  const signals = {
    ...base.signals,
    predictiveScoring: scenario.aiMode === 'Predictive ML',
    documentProcessing: scenario.aiMode === 'No AI' ? false : base.signals.documentProcessing,
    knowledgeRetrieval: scenario.aiMode === 'RAG',
    generativeResponse: ['GenAI', 'RAG', 'Agentic AI'].includes(scenario.aiMode),
    toolExecution: scenario.aiMode === 'Agentic AI',
    workflowOrchestration: scenario.aiMode === 'No AI' ? false : scenario.aiMode === 'Agentic AI' || base.signals.workflowOrchestration,
  }
  return {
    ...base,
    latency: scenario.latency,
    monthlyRequests: scenario.monthlyRequests,
    aiRequirement: scenario.aiMode === 'No AI' ? 'Not Required' : 'Required',
    sensitivity: scenario.sensitivity,
    regulatoryRequirements: scenario.compliance,
    availabilityTarget: scenario.availability,
    monthlyBudget: undefined,
    signals,
  }
}

export function evaluateWhatIfScenario(base: DecisionResult, scenario: WhatIfScenario) {
  const evidence = Object.fromEntries(base.candidates.map(candidate => [candidate.id, candidate.evidence]))
  const result = runDecisionEngine(scenarioInput(base.profile, scenario), scenario.platform || undefined, evidence)
  const targetLatency = latencyTarget(scenario.latency)
  const latencyChanged = scenario.latency !== base.profile.latency
  const candidates: SimulationCandidate[] = result.candidates.map(candidate => {
    const monthlyCost = candidate.monthlyCost.expected
    const blockingReasons = [
      ...candidate.rejectionReasons,
      ...(latencyChanged && Number.isFinite(candidate.p95LatencyMs) && candidate.p95LatencyMs > targetLatency ? [`P95 ${candidate.p95LatencyMs} ms exceeds ${targetLatency} ms target`] : []),
    ]
    return { candidate, monthlyCost, blockingReasons }
  })
  const valid = candidates.filter(item => item.blockingReasons.length === 0)
  const selected = valid[0] ?? candidates[0]
  return { result, candidates, valid, selected, factor: 1 }
}

export function defaultWhatIfScenario(decision: DecisionResult): WhatIfScenario {
  return {
    latency: decision.profile.latency,
    monthlyRequests: decision.profile.monthlyRequests,
    aiMode: inferAiMode(decision.profile),
    sensitivity: decision.profile.sensitivity,
    compliance: decision.profile.compliance,
    availability: '99.9%',
    platform: decision.platformOverride ?? '',
  }
}

function ChangeField({ label, before, children }: { label: string; before: string; children: React.ReactNode }) {
  return <label className="scenario-field"><span>{label}</span><div><small>{before}</small><ArrowRight size={14} />{children}</div></label>
}

export default function WhatIfSimulator({ decision, onClose, onScenarioApply }: Props) {
  const baseScenario = useMemo(() => defaultWhatIfScenario(decision), [decision])
  const [draft, setDraft] = useState(baseScenario)
  const [applied, setApplied] = useState(baseScenario)
  const [hasRun, setHasRun] = useState(false)
  const simulation = useMemo(() => evaluateWhatIfScenario(decision, applied), [decision, applied])
  const before = decision.recommended
  const after = simulation.selected.candidate
  const recommendationChanged = before.id !== after.id
  const changedInputs = (Object.keys(applied) as Array<keyof WhatIfScenario>).filter(key => JSON.stringify(applied[key]) !== JSON.stringify(baseScenario[key]))
  const trafficCostDelta = simulation.selected.monthlyCost - before.monthlyCost.expected
  const gateSummary = (candidate: EvaluatedCandidate) => ({ passed: candidate.gates.passedGates.length, unknown: candidate.gates.unknownGates.length, failed: candidate.gates.failedGates.length })
  const invalidated = simulation.candidates.filter(item => item.blockingReasons.length > 0)
  const reason = recommendationChanged
    ? `${changedInputs.map(key => key === 'monthlyRequests' ? 'traffic' : key).join(', ') || 'The scenario'} changes the eligible candidate set. ${after.name} now has the strongest valid requirement fit within the active requirement gates.`
    : simulation.valid.length
      ? `${after.name} remains the strongest valid option after all changed requirements, hard gates, cost estimates, and weighted scores are recalculated.`
      : `No architecture satisfies every active gate. ${after.name} is shown as the highest-ranked fallback; review the blocking constraints.`

  const toggleCompliance = (item: string) => setDraft(current => ({ ...current, compliance: current.compliance.includes(item) ? current.compliance.filter(value => value !== item) : [...current.compliance, item] }))
  const reset = () => { setDraft(baseScenario); setApplied(baseScenario); setHasRun(false) }
  const run = () => { setApplied(draft); setHasRun(true); onScenarioApply?.(draft) }

  return <section className="workspace what-if-workspace">
    <header className="simulator-header">
      <div><span>DETERMINISTIC SCENARIO ANALYSIS</span><h1>What-If Simulator</h1><p>Change architecture-significant requirements and see the resulting gates, recommendation, cost, score, and rationale.</p></div>
      <button className="button secondary" onClick={onClose}><X size={15} /> Close Simulator</button>
    </header>

    <section className="simulator-baseline">
      <div><small>BASE ARCHITECTURE</small><strong>{before.name}</strong><span>{before.platformProvider} · {architectureComponents(before)}</span></div>
      <dl><div><dt>Status</dt><dd>{statusText(before.status)}</dd></div><div><dt>Cost</dt><dd>{money(before.monthlyCost.expected)}</dd></div><div><dt>P95</dt><dd>{latencyValue(before.p95LatencyMs)}</dd></div><div><dt>Eligible</dt><dd>{before.eligible ? 'Yes' : 'No'}</dd></div></dl>
    </section>

    <section className="scenario-builder">
      <div className="simulator-section-title"><div><Waypoints size={18} /><span><h2>Change Requirements</h2><p>Original values are shown on the left; choose the scenario on the right.</p></span></div><button onClick={reset}><RefreshCw size={14} /> Reset</button></div>
      <div className="scenario-grid">
        <ChangeField label="Latency" before={baseScenario.latency}><select aria-label="What-if latency" value={draft.latency} onChange={event => setDraft({ ...draft, latency: event.target.value })}>{latencyOptions.map(item => <option key={item}>{item}</option>)}</select></ChangeField>
        <ChangeField label="Traffic" before={baseScenario.monthlyRequests}><select aria-label="What-if traffic" value={draft.monthlyRequests} onChange={event => setDraft({ ...draft, monthlyRequests: event.target.value })}>{trafficOptions.map(item => <option key={item}>{item}</option>)}</select></ChangeField>
        <ChangeField label="AI Requirement" before={baseScenario.aiMode}><select aria-label="What-if AI requirement" value={draft.aiMode} onChange={event => setDraft({ ...draft, aiMode: event.target.value as AiMode })}>{(['No AI', 'Predictive ML', 'GenAI', 'RAG', 'Agentic AI'] as AiMode[]).map(item => <option key={item}>{item}</option>)}</select></ChangeField>
        <ChangeField label="Data Sensitivity" before={baseScenario.sensitivity}><select aria-label="What-if sensitivity" value={draft.sensitivity} onChange={event => setDraft({ ...draft, sensitivity: event.target.value })}>{sensitivityOptions.map(item => <option key={item}>{item}</option>)}</select></ChangeField>
        <ChangeField label="Availability" before={baseScenario.availability}><select aria-label="What-if availability" value={draft.availability} onChange={event => setDraft({ ...draft, availability: event.target.value })}>{availabilityOptions.map(item => <option key={item}>{item}</option>)}</select></ChangeField>
        <ChangeField label="Cloud Provider" before={baseScenario.platform || `Auto (${before.platformProvider})`}><select aria-label="What-if cloud provider" value={draft.platform} onChange={event => setDraft({ ...draft, platform: event.target.value })}><option value="">Any / Auto</option>{platformOptions.map(item => <option key={item}>{item}</option>)}</select></ChangeField>
      </div>
      <fieldset className="scenario-compliance"><legend>Compliance</legend>{complianceOptions.map(item => <label key={item}><input type="checkbox" checked={draft.compliance.includes(item)} onChange={() => toggleCompliance(item)} /> {item}</label>)}</fieldset>
      <button className="button primary run-simulation" onClick={run}><Play size={16} /> Run Simulation</button>
    </section>

    <section className={`simulation-status ${recommendationChanged ? 'changed' : ''}`}>
      <span>{recommendationChanged ? <RefreshCw size={20} /> : simulation.valid.length ? <Check size={20} /> : <AlertTriangle size={20} />}</span>
      <div><small>{recommendationChanged ? 'RECOMMENDATION CHANGED' : simulation.valid.length ? 'RECOMMENDATION RETAINED' : 'NO FULLY VALID OPTION'}</small><h2>{before.name} <ArrowRight size={18} /> {after.name}</h2><p>{hasRun ? reason : 'Adjust requirements and run the simulation to compare outcomes.'}</p></div>
    </section>

    <div className="before-after-grid">
      <article><header><span>BEFORE</span><b>Current decision</b></header><h3>{before.name}</h3><p>{architectureComponents(before)}</p><dl><div><dt>Platform</dt><dd>{before.platformProvider}</dd></div><div><dt>Status</dt><dd>{statusText(before.status)}</dd></div><div><dt>Cost</dt><dd>{money(before.monthlyCost.expected)}</dd></div><div><dt>Latency</dt><dd>{latencyValue(before.p95LatencyMs)}</dd></div></dl></article>
      <ArrowRight className="before-after-arrow" size={24} />
      <article className="after"><header><span>AFTER</span><b>{simulation.valid.length ? 'What-if recommendation' : 'Fallback'}</b></header><h3>{after.name}</h3><p>{architectureComponents(after)}</p><dl><div><dt>Platform</dt><dd>{after.platformProvider}</dd></div><div><dt>Status</dt><dd>{statusText(after.status)}</dd></div><div><dt>Cost</dt><dd>{money(simulation.selected.monthlyCost)}</dd></div><div><dt>Latency</dt><dd>{latencyValue(after.p95LatencyMs)}</dd></div></dl></article>
    </div>

      <section className="impact-panel">
      <div className="simulator-section-title"><div><Gauge size={18} /><span><h2>Before vs After Impact</h2><p>Every requirement gate is recalculated from the changed requirements.</p></span></div></div>
      <div className="impact-grid"><div><span>Passed gates</span><b>{gateSummary(before).passed}</b><ArrowRight size={13} /><strong>{gateSummary(after).passed}</strong></div><div><span>Unknown gates</span><b>{gateSummary(before).unknown}</b><ArrowRight size={13} /><strong>{gateSummary(after).unknown}</strong></div><div><span>Failed gates</span><b>{gateSummary(before).failed}</b><ArrowRight size={13} /><strong>{gateSummary(after).failed}</strong></div><div><span>Monthly Cost</span><b>{money(before.monthlyCost.expected)}</b><ArrowRight size={13} /><strong>{money(simulation.selected.monthlyCost)}</strong><em className={simulation.selected.monthlyCost <= before.monthlyCost.expected ? 'positive' : 'negative'}>{moneyDetailed(Math.abs(trafficCostDelta))}</em></div></div>
      <p className="traffic-impact-note"><b>Applied traffic: {applied.monthlyRequests} = {simulation.result.profile.monthlyRequestCount.toLocaleString()} requests/month.</b><span>Traffic changes variable storage, networking, monitoring, messaging, and AI inference when applicable. Provisioned compute, database, and search remain sized from the separate peak request rate.</span></p>
    </section>

    <div className="simulator-two-column">
      <section className="invalidated-panel"><div className="simulator-section-title"><div><AlertTriangle size={18} /><span><h2>What Became Invalid?</h2><p>{invalidated.length} candidates fail one or more active gates.</p></span></div></div><div>{invalidated.map(item => <article key={item.candidate.id}><span><X size={13} /></span><div><b>{item.candidate.name}</b><small>{item.blockingReasons.join(' · ')}</small></div></article>)}</div></section>
      <section className="explanation-panel"><div className="simulator-section-title"><div><ShieldCheck size={18} /><span><h2>What Changed?</h2><p>Deterministic explanation trace</p></span></div></div><dl><div><dt>Input</dt><dd>{changedInputs.length ? changedInputs.map(key => key === 'monthlyRequests' ? 'Traffic' : key[0].toUpperCase() + key.slice(1)).join(', ') : 'No changes applied'}</dd></div><div><dt>Architecture impact</dt><dd>{recommendationChanged ? `${before.name} to ${after.name}` : `${after.name} retained`}</dd></div><div><dt>New cost / status</dt><dd>{money(simulation.selected.monthlyCost)} · {statusText(after.status)}</dd></div><div><dt>Reason</dt><dd>{reason}</dd></div><div><dt>Confidence</dt><dd>{simulation.result.confidence}% · {simulation.result.confidenceLabel}</dd></div></dl></section>
    </div>

  </section>
}
