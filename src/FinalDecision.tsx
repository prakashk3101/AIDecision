import { Activity, Bot, Boxes, Check, CircleDollarSign, Cloud, Eye, FileText, Gauge, Network, ShieldCheck, Waypoints } from 'lucide-react'
import { modelCatalog, type TokenUsage } from './catalog/modelCatalog'
import { applySelectedModel, type DecisionResult, type EvaluatedCandidate, type RequirementResult } from './domain/decisionEngine'
import { defaultWhatIfScenario, evaluateWhatIfScenario, type WhatIfScenario } from './WhatIfSimulator'

type Props = {
  decision: DecisionResult
  scenario: WhatIfScenario | null
  selectedModelId?: string
  optimizedTokenUsage?: TokenUsage
}

const money = (value: number) => Number.isFinite(value) ? `$${Math.round(value).toLocaleString()}` : 'Unavailable'
const metric = (value: number, unit: string) => Number.isFinite(value) ? `${value.toLocaleString()} ${unit}` : 'Unavailable'
const statusText = (status: EvaluatedCandidate['status']) => status === 'eligible' ? 'Eligible' : status === 'partiallyEligible' ? 'Partially eligible' : 'Not eligible'
const findFit = (candidate: EvaluatedCandidate, prefix: string) => candidate.requirementFit.find(item => item.requirement.startsWith(prefix))
const toneFor = (status?: RequirementResult['status']) => status === 'met' ? 'strong' : status === 'notMet' ? 'attention' : 'moderate'
const fitVerdict = (fit?: RequirementResult) => fit?.status === 'unknown' && fit.indicator ? fit.indicator : fit?.status ?? 'unknown'
const metricTone = (score: number) => score >= 85 ? 'strong' : score >= 70 ? 'moderate' : 'attention'
const reliabilityIndex = (candidate: EvaluatedCandidate) => Math.round(candidate.maintainability * .35 + candidate.operationalFit * .35 + candidate.evidenceQuality * .3)

export default function FinalDecision({ decision, scenario, selectedModelId, optimizedTokenUsage }: Props) {
  const activeScenario = scenario ?? defaultWhatIfScenario(decision)
  const simulation = evaluateWhatIfScenario(decision, activeScenario)
  const finalProfile = optimizedTokenUsage ? { ...simulation.result.profile, tokenUsage: optimizedTokenUsage } : simulation.result.profile
  const candidate = applySelectedModel(simulation.selected.candidate, finalProfile, selectedModelId)
  const model = candidate.selectedModel ? modelCatalog.find(item => item.id === candidate.selectedModel?.id) : undefined
  const finalMonthlyCost = candidate.monthlyCost.expected
  const costFactor = 1
  const costBreakdown = Object.entries(candidate.monthlyCost.breakdown).map(([name, value]) => [name, Math.round(value * costFactor)] as const)
  const reliability = reliabilityIndex(candidate)
  const capacityEstimated = !Number.isFinite(candidate.maxRequestsPerSecond) && candidate.evaluations.scalability.estimatedCapacity !== null
  const capacity = capacityEstimated ? candidate.evaluations.scalability.estimatedCapacity! : candidate.maxRequestsPerSecond
  const capacityHeadroom = Number.isFinite(candidate.scalabilityHeadroom) ? candidate.scalabilityHeadroom : capacityEstimated ? capacity / Math.max(1, simulation.result.profile.peakRequestsPerSecond) : Number.NaN
  const performanceFit = findFit(candidate, 'Latency')
  const capacityFit = findFit(candidate, 'Capacity')
  const observability = candidate.technologies.filter(item => /monitor|observability|trace|application insights|x-ray/i.test(`${item.component} ${item.product}`))
  const layers = (['Edge & Network', 'Services', 'AI & Guardrails', 'Data & Operations'] as const).map(layer => ({
    layer,
    technologies: candidate.technologies.filter(item => item.layer === layer),
  })).filter(item => item.technologies.length)
  const status = simulation.valid.length ? 'Approved candidate' : 'Conditional decision'
  const downloadAdr = async () => {
    const { generateAdrPdf } = await import('./adrPdf')
    generateAdrPdf(decision, candidate)
  }

  return <section className="workspace decide-workspace">
    <header className="decide-header">
      <div><span>FINAL SOLUTION DECISION</span><h1>Decide</h1><p>Consolidated architecture based on the latest simulator scenario and deterministic LLM recommendation from Cost Analysis.</p></div>
      <div className="decide-actions"><div className={`decision-readiness ${simulation.valid.length ? 'approved' : ''}`}><Check size={17} /><span><b>{status}</b><small>{scenario ? 'Latest simulator run applied' : 'Baseline scenario applied'}</small></span></div><button className="button primary" onClick={downloadAdr}><FileText size={17} /> Download ADR PDF</button></div>
    </header>

    <section className="final-solution-banner">
      <div><small>SELECTED SOLUTION</small><h2>{candidate.name}</h2><p>{candidate.pattern} on {candidate.platformProvider}</p></div>
      <dl><div><dt>Status</dt><dd>{statusText(candidate.status)}</dd></div><div><dt>Decision confidence</dt><dd>{simulation.result.confidence}%</dd></div><div><dt>Final monthly cost</dt><dd>{money(finalMonthlyCost)}</dd></div></dl>
    </section>

    <section className="decide-metric-grid">
      <article><span><Gauge size={17} /></span><div><small>PERFORMANCE</small><strong>{Number.isFinite(candidate.p95LatencyMs) ? `${candidate.p95LatencyMs.toLocaleString()}ms` : `~${candidate.latencyEstimate.p95Ms.toLocaleString()}ms est.`}</strong><p>{Number.isFinite(candidate.p95LatencyMs) ? 'Measured P95' : 'Composed estimate'} · target {activeScenario.latency}</p></div><i className={toneFor(fitVerdict(performanceFit))}>{fitVerdict(performanceFit)}</i></article>
      <article><span><Waypoints size={17} /></span><div><small>SCALABILITY</small><strong>{capacityEstimated ? `~${capacity.toLocaleString()} req/s est.` : metric(capacity, 'req/s')}</strong><p>{Number.isFinite(capacityHeadroom) ? `${capacityHeadroom.toFixed(1)}x estimated peak-load headroom` : 'Capacity evidence unavailable'}</p></div><i className={toneFor(fitVerdict(capacityFit))}>{fitVerdict(capacityFit)}</i></article>
      <article><span><Activity size={17} /></span><div><small>RELIABILITY</small><strong>{reliability}/100</strong><p>Readiness index, not an uptime guarantee</p></div><i className={metricTone(reliability)}>{reliability}</i></article>
      <article><span><Cloud size={17} /></span><div><small>AVAILABILITY</small><strong>{activeScenario.availability}</strong><p>Requested design target</p></div><i className="strong">SLA</i></article>
      <article><span><ShieldCheck size={17} /></span><div><small>SECURITY</small><strong>{candidate.evaluations.security.missingControls.length === 0 ? 'All controls confirmed' : `${candidate.evaluations.security.missingControls.length} control(s) missing`}</strong><p>{activeScenario.sensitivity}</p></div><i className={candidate.evaluations.security.missingControls.length === 0 ? 'strong' : 'attention'}>{candidate.evaluations.security.missingControls.length}</i></article>
      <article><span><Eye size={17} /></span><div><small>OBSERVABILITY</small><strong>{observability.length ? observability.map(item => item.product).join(', ') : `${candidate.platformProvider} native monitoring`}</strong><p>Telemetry, health, tracing, and audit</p></div><i className="strong">Ready</i></article>
    </section>

    <div className="decide-main-grid">
      <section className="final-architecture-panel">
        <div className="decide-section-heading"><Network size={18} /><div><h2>Detailed Solution Architecture</h2><p>Final platform products mapped to functional layers.</p></div></div>
        <div className="final-architecture-flow"><div className="final-channel"><Boxes size={17} /><span><b>Users & Channels</b><small>Web · Mobile · Operations · Partner API</small></span></div>{layers.map((item, index) => <div className="final-layer" key={item.layer}>{index >= 0 && <span className="final-connector" />}<small>{item.layer}</small><div>{item.technologies.map(technology => <article key={technology.component}><b>{technology.component}</b><strong>{technology.product}</strong><p>{technology.functionalRequirement}</p></article>)}</div></div>)}</div>
      </section>

      <aside className="final-model-panel">
        <div className="decide-section-heading"><Bot size={18} /><div><h2>Selected LLM Model</h2><p>From deterministic Cost Analysis ranking.</p></div></div>
        {candidate.selectedModel ? <><div className="final-model-name"><small>RECOMMENDED MODEL</small><h3>{candidate.selectedModel.name}</h3><p>{model?.provider ?? 'Model provider'} · Hosted on {candidate.platformProvider}</p></div><dl><div><dt>Model fit</dt><dd>{candidate.selectedModel.score}/100</dd></div><div><dt>Token cost</dt><dd>{money(candidate.selectedModel.monthlyCost)}/month</dd></div><div><dt>Context</dt><dd>{model?.capabilities.contextWindow.toLocaleString() ?? 'N/A'} tokens</dd></div><div><dt>Reasoning</dt><dd>{model?.capabilities.reasoning ?? 'N/A'}/100</dd></div><div><dt>Security</dt><dd>{model?.securityScore ?? 'N/A'}/100</dd></div><div><dt>Reliability</dt><dd>{model?.reliabilityScore ?? 'N/A'}/100</dd></div></dl><p className="final-model-reason"><Check size={13} /> Highest valid weighted model score for the selected workload and cloud.</p></> : <div className="final-no-model"><Bot size={22} /><b>No generative model required</b><p>The selected architecture does not require LLM inference.</p></div>}
      </aside>
    </div>

    <div className="decide-detail-grid">
      <section className="final-quality-panel"><div className="decide-section-heading"><Activity size={18} /><div><h2>Operational Quality Detail</h2><p>Deterministic requirement status and capacity evidence.</p></div></div><dl><div><dt>Performance evidence</dt><dd>{fitVerdict(performanceFit)}</dd></div><div><dt>Peak capacity</dt><dd>{capacityEstimated ? `~${capacity.toLocaleString()} req/s est.` : metric(capacity, 'req/s')}</dd></div><div><dt>Scale headroom</dt><dd>{Number.isFinite(capacityHeadroom) ? `${capacityHeadroom.toFixed(1)}x est.` : 'Unavailable'}</dd></div><div><dt>Maintainability</dt><dd>{candidate.maintainability}/100</dd></div><div><dt>Operational fit</dt><dd>{candidate.operationalFit}/100</dd></div><div><dt>Evidence records</dt><dd>{candidate.evidence.length}</dd></div><div><dt>Availability target</dt><dd>{activeScenario.availability}</dd></div><div><dt>Monthly traffic</dt><dd>{activeScenario.monthlyRequests}</dd></div></dl></section>
      <section className="final-security-panel"><div className="decide-section-heading"><ShieldCheck size={18} /><div><h2>Security & Compliance</h2><p>Controls driven by the selected scenario.</p></div></div><div className="final-control-list">{[activeScenario.sensitivity, ...activeScenario.compliance, ...simulation.result.profile.securityRequirements].filter((item, index, all) => item && all.indexOf(item) === index).map(item => <span key={item}><Check size={12} />{item}</span>)}</div><h3>Security architecture</h3><ul>{candidate.technologies.filter(item => /identity|security|compliance|private|key|protection|guardrail|firewall/i.test(`${item.component} ${item.product}`)).map(item => <li key={item.component}><b>{item.component}</b><span>{item.product}</span></li>)}</ul></section>
      <section className="final-observability-panel"><div className="decide-section-heading"><Eye size={18} /><div><h2>Observability & Operations</h2><p>Production monitoring and response posture.</p></div></div><ul><li><b>Platform telemetry</b><span>{observability.length ? observability.map(item => item.product).join(', ') : `${candidate.platformProvider} monitoring services`}</span></li><li><b>Health</b><span>Availability, latency, error rate, and saturation indicators</span></li><li><b>AI operations</b><span>Token usage, model latency, quality, safety, and cost telemetry</span></li><li><b>Audit</b><span>Decision trace, access activity, and compliance evidence</span></li><li><b>Response</b><span>Alert routing, dashboards, incident runbooks, and service ownership</span></li></ul></section>
    </div>

    <section className="final-cost-panel">
      <div className="decide-section-heading"><CircleDollarSign size={18} /><div><h2>Final Solution Cost</h2><p>Architecture, platform, AI inference, security, operations, and {activeScenario.availability} availability adjustment.</p></div></div>
      <div className="final-cost-total"><small>EXPECTED MONTHLY TOTAL</small><strong>{money(finalMonthlyCost)}</strong><span>Planning range {money(candidate.monthlyCost.low * costFactor)}–{money(candidate.monthlyCost.high * costFactor)}</span></div>
      <div className="final-cost-breakdown">{costBreakdown.map(([name, value]) => <div key={name}><span>{name}</span><b>{money(value)}</b><div><i style={{ width: `${value / Math.max(1, finalMonthlyCost) * 100}%` }} /></div></div>)}</div>
      <footer><span>Low planning range <b>{money(candidate.monthlyCost.low * costFactor)}</b></span><span>Expected <b>{money(finalMonthlyCost)}</b></span><span>High planning range <b>{money(candidate.monthlyCost.high * costFactor)}</b></span></footer>
    </section>
  </section>
}
