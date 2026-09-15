import { useEffect, useState } from 'react'
import {
  Activity, Bot, Boxes, Check, ChevronRight, Cloud, Database, FileText, Gauge, Network,
  ExternalLink, GitCompareArrows, Globe, MonitorCog, PlugZap, Play, RefreshCw, Shield,
  ShieldCheck, Smartphone, Sparkles, Waypoints, X, Zap,
} from 'lucide-react'
import { platformOptions, runDecisionEngine, type DecisionResult, type EvaluatedCandidate, type RequirementResult } from './domain/decisionEngine'
import WhatIfSimulator, { type WhatIfScenario } from './WhatIfSimulator'

type Props = {
  decision: DecisionResult
  selectedId: string
  onSelect: (id: string) => void
  onEdit: () => void
  showWhatIf: boolean
  onWhatIfChange: (show: boolean) => void
  onScenarioApply: (scenario: WhatIfScenario) => void
  onPlatformChange: (platform: string) => void
  compareMode?: boolean
}

const statusText = (status: EvaluatedCandidate['status']) => status === 'eligible' ? 'Eligible' : status === 'partiallyEligible' ? 'Partially eligible' : 'Not eligible'
const requirementStatusText = (item: RequirementResult) => item.status === 'unknown' && item.indicator ? item.indicator : item.status
const requirementIcon = (item: RequirementResult) => {
  const status = requirementStatusText(item)
  return status === 'met' ? '✓' : status === 'partial' ? '~' : status === 'notMet' ? '✕' : ''
}

const nodeIcons = [Waypoints, Network, Activity, Bot, Shield, Database, Boxes, Cloud, Zap]

const money = (value: number) => Number.isFinite(value) ? `$${Math.round(value).toLocaleString()}` : 'Unavailable'
const moneyDetailed = (value: number) => Number.isFinite(value)
  ? value === 0 ? '$0' : value < 1 ? `$${value.toFixed(2)}` : value < 100 ? `$${value.toFixed(2)}` : money(value)
  : 'Unavailable'
const costValue = (candidate: EvaluatedCandidate) => candidate.monthlyCost.available ? money(candidate.monthlyCost.expected) : 'Pending prices'
const costRange = (candidate: EvaluatedCandidate) => candidate.monthlyCost.available
  ? `${money(candidate.monthlyCost.low)}–${money(candidate.monthlyCost.high)}`
  : `Pending: ${candidate.monthlyCost.missingCategories.join(', ') || 'official prices'}`
// Falls back to the composed estimate so the tile is never blank when no measurement exists.
const latencyValue = (candidate: EvaluatedCandidate) => Number.isFinite(candidate.p95LatencyMs)
  ? `${candidate.p95LatencyMs.toLocaleString()} ms`
  : `~${candidate.latencyEstimate.p95Ms.toLocaleString()} ms est.`
const capacityValue = (candidate: EvaluatedCandidate) => Number.isFinite(candidate.maxRequestsPerSecond)
  ? `${candidate.maxRequestsPerSecond.toLocaleString()} req/s`
  : candidate.evaluations.scalability.estimatedCapacity === null ? 'Unavailable' : `~${candidate.evaluations.scalability.estimatedCapacity.toLocaleString()} req/s est.`
const availabilityValue = (candidate: EvaluatedCandidate) => Number.isFinite(candidate.availabilityTargetPercent)
  ? `${candidate.availabilityTargetPercent}%`
  : candidate.evaluations.availability.estimatedSlaPercent === null ? 'Unavailable' : `~${candidate.evaluations.availability.estimatedSlaPercent}% est.`

const metricDelta = (left: number, right: number, suffix = '') => Number.isFinite(left) && Number.isFinite(right)
  ? `${right >= left ? '+' : ''}${Math.round(right - left).toLocaleString()}${suffix}`
  : 'N/A'

function ComparePlatformView({ decision }: { decision: DecisionResult }) {
  const platforms = Object.keys(decision.recommended.platformScores).length ? Object.keys(decision.recommended.platformScores) : platformOptions
  const defaultLeft = decision.platformOverride ?? decision.recommended.platformProvider
  const [leftProvider, setLeftProvider] = useState(defaultLeft)
  const [rightProvider, setRightProvider] = useState('')
  const effectiveRightProvider = rightProvider && rightProvider !== leftProvider
    ? rightProvider
    : platforms.find(platform => platform !== leftProvider) ?? leftProvider
  const leftDecision = runDecisionEngine(decision.profile, leftProvider)
  const rightDecision = runDecisionEngine(decision.profile, effectiveRightProvider)
  const left = leftDecision.recommended
  const right = rightDecision.recommended
  const serviceDiffs = left.technologies.flatMap(technology => {
    const peer = right.technologies.find(item => item.component === technology.component)
    return peer && peer.product !== technology.product ? [{ component: technology.component, left: technology.product, right: peer.product }] : []
  })
  const metricCards = [
    ['Architecture', left.name, right.name, left.name === right.name ? 'Same pattern' : 'Different recommendation'],
    ['Status', statusText(left.status), statusText(right.status), `${right.gates.failedGates.length - left.gates.failedGates.length} failed gate delta`],
    ['Monthly cost', costValue(left), costValue(right), metricDelta(left.monthlyCost.expected, right.monthlyCost.expected)],
    ['Cost range', costRange(left), costRange(right), 'Planning low-high'],
    ['Latency', latencyValue(left), latencyValue(right), metricDelta(left.latencyEstimate.p95Ms, right.latencyEstimate.p95Ms, ' ms')],
    ['Peak capacity', capacityValue(left), capacityValue(right), metricDelta(left.evaluations.scalability.estimatedCapacity ?? left.maxRequestsPerSecond, right.evaluations.scalability.estimatedCapacity ?? right.maxRequestsPerSecond, ' req/s')],
    ['Availability', availabilityValue(left), availabilityValue(right), 'SLA/estimate'],
    ['Selected model', left.selectedModel?.name ?? 'N/A', right.selectedModel?.name ?? 'N/A', left.selectedModel?.name === right.selectedModel?.name ? 'Same model' : 'Different model'],
  ]

  return <section className="workspace decision-workspace compare-workspace">
    <div className="title-row">
      <div><span className="decision-kicker">Platform comparison</span><h1>{decision.profile.name} <Sparkles size={17} /></h1></div>
      <div className="page-actions"><label className="platform-selector"><span>Left platform</span><select value={leftProvider} onChange={event => setLeftProvider(event.target.value)}>{platforms.map(platform => <option key={platform} value={platform}>{platform}</option>)}</select></label><label className="platform-selector"><span>Right platform</span><select value={effectiveRightProvider} onChange={event => setRightProvider(event.target.value)}>{platforms.map(platform => <option key={platform} value={platform}>{platform}</option>)}</select></label></div>
    </div>

    <div className="compare-grid">
      <section className="card compare-platform-card">
        <div className="card-heading"><h2>{leftProvider}</h2><span className={`status-pill ${left.status}`}>{statusText(left.status)}</span></div>
        <div className="recommendation-top"><div><h3>{left.name}</h3><p>{left.pattern}</p></div></div>
        <dl><div><dt>Expected cost</dt><dd>{costValue(left)}</dd></div><div><dt>Range</dt><dd>{costRange(left)}</dd></div><div><dt>Latency</dt><dd>{latencyValue(left)}</dd></div><div><dt>Capacity</dt><dd>{capacityValue(left)}</dd></div></dl>
      </section>

      <section className="card compare-platform-card">
        <div className="card-heading"><h2>{effectiveRightProvider}</h2><span className={`status-pill ${right.status}`}>{statusText(right.status)}</span></div>
        <div className="recommendation-top"><div><h3>{right.name}</h3><p>{right.pattern}</p></div></div>
        <dl><div><dt>Expected cost</dt><dd>{costValue(right)}</dd></div><div><dt>Range</dt><dd>{costRange(right)}</dd></div><div><dt>Latency</dt><dd>{latencyValue(right)}</dd></div><div><dt>Capacity</dt><dd>{capacityValue(right)}</dd></div></dl>
      </section>

      <section className="card compare-differences-card">
        <div className="trace-heading"><div><span><GitCompareArrows size={17} /></span><div><h2>Key Differences</h2><p>Only decision-driving differences between the selected cloud platforms.</p></div></div></div>
        <div className="compare-metric-grid">{metricCards.map(([label, leftValue, rightValue, delta]) => <article key={label}>
          <h3>{label}</h3>
          <div><span>{leftProvider}</span><b>{leftValue}</b></div>
          <div><span>{effectiveRightProvider}</span><b>{rightValue}</b></div>
          <footer>{delta}</footer>
        </article>)}</div>
      </section>

      <section className="card compare-services-card">
        <div className="card-heading"><h2>Changed Services</h2><span className="eligible-count">{serviceDiffs.length} differences</span></div>
        <div className="compare-service-list">{serviceDiffs.length ? serviceDiffs.slice(0, 12).map((item, index) => <article key={item.component}>
          <i>{index + 1}</i><div><h3>{item.component}</h3><p><b>{leftProvider}</b>{item.left}</p><p><b>{effectiveRightProvider}</b>{item.right}</p></div>
        </article>) : <article><i>✓</i><div><h3>No service mapping changes</h3><p>The selected platforms use the same catalog products for this architecture.</p></div></article>}</div>
      </section>
    </div>
  </section>
}

function CandidateDiagram({ candidate }: { candidate: EvaluatedCandidate }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const stages = (['Edge & Network', 'Services', 'AI & Guardrails', 'Data & Operations'] as const).map(label => ({
    label,
    technologies: candidate.technologies.filter(technology => technology.layer === label),
  })).filter(stage => stage.technologies.length > 0)
  return <section className="card architecture-card">
    <div className="card-heading"><div><h2>Selected Solution Architecture</h2><p>{candidate.name} · {candidate.pattern}</p></div><span className="platform-pill">Platform: {candidate.platformProvider}</span><span className="interactive-label"><Play size={12} /> Requirement-driven</span></div>
    <div className="architecture-content">
      <div className="architecture-visual">
        <div className="channels"><span>Users / Channels</span><div><b><Globe aria-hidden="true" /><small>Web</small></b><b><Smartphone aria-hidden="true" /><small>Mobile</small></b><b><MonitorCog aria-hidden="true" /><small>Operations</small></b><b><PlugZap aria-hidden="true" /><small>Partner API</small></b></div></div>
        <div className="diagram-flow" aria-label={`${candidate.name} architecture diagram`}>
          {stages.map((stage, stageIndex) => <div className="flow-group" key={stage.label}>
            {stageIndex > 0 && <span className="flow-connector" aria-hidden="true" />}
            <small className="flow-label">{stage.label}</small>
            <div className={`flow-stage ${stage.technologies.length > 1 ? 'branched' : ''}`}>
              {stage.technologies.map((technology, componentIndex) => {
                const Icon = nodeIcons[(stageIndex * 2 + componentIndex) % nodeIcons.length]
                return <button key={technology.component} title={`${technology.component}: ${technology.product}`} className={`flow-node ${selectedNode === technology.component ? 'selected' : ''}`} onClick={() => setSelectedNode(selectedNode === technology.component ? null : technology.component)}>
                  <Icon size={17} /><span><strong>{technology.component}</strong><small>{technology.product}</small></span>
                </button>
              })}
            </div>
          </div>)}
        </div>
      </div>
      <aside className="architecture-rationale">
        <div className={`rationale-gate ${candidate.eligible ? 'passed' : 'failed'}`}><ShieldCheck size={16} /><span><b>{candidate.eligible ? 'Mandatory gates passed' : 'Constraints require review'}</b><small>{candidate.eligible ? 'All required capabilities are supported.' : candidate.rejectionReasons[0]}</small></span></div>
        <div className="component-rationale-heading"><div><h3>Component requirement traceability</h3><p>Why each component is part of this solution</p></div><b>{candidate.technologies.length}</b></div>
        <div className="component-rationale-list">{candidate.technologies.map(technology => <button key={technology.component} className={selectedNode === technology.component ? 'selected' : ''} onClick={() => setSelectedNode(selectedNode === technology.component ? null : technology.component)}>
          <span className="component-callout-title"><strong>{technology.component}</strong><small>{technology.product}</small></span>
          <span className="requirement-callout functional"><b>Functional</b><small>{technology.functionalRequirement}</small></span>
          <span className="requirement-callout non-functional"><b>Non-functional</b><small>{technology.nonFunctionalRequirement}</small></span>
        </button>)}</div>
      </aside>
    </div>
    {selectedNode && <div className="node-detail"><strong>{selectedNode}</strong><span>{candidate.technologies.find(item => item.component === selectedNode)?.product} · {candidate.platformProvider}</span><button onClick={() => setSelectedNode(null)} aria-label="Close details"><X size={14} /></button></div>}
  </section>
}

export default function ArchitectureDecision({ decision, selectedId, onSelect, onPlatformChange, onEdit, showWhatIf, onWhatIfChange, onScenarioApply, compareMode = false }: Props) {
  const [showEvidence, setShowEvidence] = useState(false)
  const selected = decision.candidates.find(candidate => candidate.id === selectedId) ?? decision.recommended
  const platforms = Object.keys(selected.platformScores).length ? Object.keys(selected.platformScores) : platformOptions
  const selectedEvidence = [...selected.evidence, ...(selected.selectedModel?.evidence ?? [])]
  const costBreakdown = Object.entries(selected.monthlyCost.breakdown).filter(([, value]) => value > 0)
  const selectedIsWinner = selected.id === decision.recommended.id
  const eligible = decision.candidates.filter(candidate => candidate.status === 'eligible')
  const estimatedCapacity = selected.evaluations.scalability.estimatedCapacity
  const scaleHeadroom = Number.isFinite(selected.scalabilityHeadroom)
    ? `${selected.scalabilityHeadroom.toFixed(1)}x${Number.isFinite(selected.maxRequestsPerSecond) ? '' : ' est.'}`
    : 'Unavailable'
  const metricTooltips = {
    latency: Number.isFinite(selected.p95LatencyMs)
      ? 'Measured P95 latency from validated architecture evidence.'
      : `Composed estimate: ${selected.latencyEstimate.overheadMs.toLocaleString()}ms architecture overhead + model time to first token + output tokens divided by output-token speed.`,
    capacity: estimatedCapacity === null
      ? 'No documented or measured capacity evidence is available.'
      : `${Number.isFinite(selected.maxRequestsPerSecond) ? 'Measured or documented' : 'Estimated'} capacity from the most conservative capacity evidence: ${estimatedCapacity.toLocaleString()} req/s.`,
    availability: Number.isFinite(selected.availabilityTargetPercent)
      ? 'Measured or documented SLA from validated availability evidence.'
      : selected.evaluations.availability.estimatedSlaPercent === null ? 'No availability evidence is available.' : `Estimated SLA from architecture evidence: ${selected.evaluations.availability.estimatedSlaPercent}%.`,
    headroom: estimatedCapacity === null ? 'Unavailable because capacity evidence is missing.' : `Capacity headroom = ${estimatedCapacity.toLocaleString()} req/s divided by ${decision.profile.peakRequestsPerSecond.toLocaleString()} peak req/s = ${selected.scalabilityHeadroom.toFixed(1)}x.`,
    requests: `Monthly request count derived from the assessment range: ${decision.profile.monthlyRequests}.`,
    evidence: `Validated architecture evidence records plus selected-model evidence: ${selected.evidence.length} architecture record(s).`,
    updated: `Catalog metadata last updated on ${new Date(selected.metricsUpdatedAt).toLocaleDateString()}.`,
    platform: `Provider selected from the assessment preference or platform comparison: ${selected.platformProvider}.`,
    model: selected.selectedModel ? `Capability-gated model selection for ${decision.profile.requirements.genAI ? 'the generative AI workload' : 'this workload'}: ${selected.selectedModel.name}.` : 'No compatible generative model is required.',
    modelCost: selected.selectedModel ? `Published model token pricing multiplied by ${decision.profile.tokenUsage.requestsPerMonth.toLocaleString()} monthly requests, input tokens, cached input tokens, and output tokens.` : 'No model token cost applies.',
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [compareMode, decision.generatedAt])

  if (showWhatIf) return <WhatIfSimulator decision={decision} onClose={() => onWhatIfChange(false)} onScenarioApply={onScenarioApply} />
  if (compareMode) return <ComparePlatformView decision={decision} />

  return <section className="workspace decision-workspace">
    <div className="title-row">
      <div><span className="decision-kicker">Deterministic recommendation</span><h1>{decision.profile.name} <Sparkles size={17} /></h1></div>
      <div className="page-actions"><button className="button secondary" onClick={onEdit}><ChevronRight className="edit-back-icon" size={15} /> Edit Assessment</button><button className="button secondary" onClick={() => onWhatIfChange(!showWhatIf)}><RefreshCw size={15} /> What-If</button></div>
    </div>
    <ol className="stepper">{['Requirement', 'Workload', 'Constraints', 'Architecture Options', 'Recommendation', 'Review'].map((step, index) => <li key={step} className={index < 4 ? 'complete' : index === 4 ? 'current' : ''}><span>{index + 1}</span><b>{step}</b></li>)}</ol>

    <div className="dashboard-grid">
      <section className="card recommendation-card">
        <div className="card-heading"><h2>{selectedIsWinner ? 'Recommended Architecture' : 'Selected Alternative'}</h2></div>
        <div className="recommendation-top"><div><h3>{selected.name}</h3><p>{selected.pattern}</p></div><div className={`status-pill ${selected.status}`}>{statusText(selected.status)}</div></div>
        <div className="confidence"><span>Decision Confidence <Gauge size={13} /></span><b>{decision.confidence}% · {decision.confidenceLabel}</b></div><div className="progress"><i style={{ width: `${decision.confidence}%` }} /></div>
        <h4>Why this is recommended</h4><ul className="check-list">{(selectedIsWinner ? decision.reasons : selected.strengths).slice(0, 5).map(reason => <li key={reason}>{reason}</li>)}</ul>
        <button className="button secondary full" onClick={() => document.getElementById('decision-trace')?.scrollIntoView({ behavior: 'smooth' })}>View Decision Trace</button>
        <button className="button secondary full" onClick={() => setShowEvidence(value => !value)}>{showEvidence ? 'Hide Evidence' : `View Evidence (${selectedEvidence.length})`}</button>
      </section>

      <CandidateDiagram candidate={selected} />

      <section className="card scorecard-card">
        <div className="card-heading"><h2>Requirement Fit</h2><span className="rule-version">Deterministic gates</span></div>
        <div className="score-list">{selected.requirementFit.map((item, index) => <div key={`${item.requirement}-${index}`}><span><b>{`${requirementIcon(item)} ${item.requirement}`.trim()}</b><small>{item.explanation}</small></span></div>)}</div>
        <div className="cost-summary"><span>Expected Monthly Cost</span><strong>{costValue(selected)}</strong><button>Range {costRange(selected)}</button></div>
      </section>

      <section className="card options-card architecture-options-card">
        <div className="card-heading"><div><h2>Architecture Options ({decision.candidates.length})</h2><span className="eligible-count">{eligible.length} eligible</span></div><label className="platform-selector"><span>Platform</span><select value={decision.platformOverride ?? ''} onChange={event => onPlatformChange(event.target.value)}><option value="">Auto ({selected.platformProvider})</option>{platforms.map(platform => <option key={platform} value={platform}>{platform}</option>)}</select></label></div>
        <div className="option-list">{decision.candidates.map((candidate, index) => <button key={candidate.id} className={`${selected.id === candidate.id ? 'selected' : ''} ${candidate.status === 'notEligible' ? 'rejected' : ''}`} onClick={() => onSelect(candidate.id)}><i>{String.fromCharCode(65 + index)}</i><span><b>{candidate.name}</b><small>{candidate.status === 'notEligible' ? candidate.rejectionReasons[0] : `${money(candidate.monthlyCost.expected)}/month`}</small></span><span><strong>{statusText(candidate.status)}</strong>{candidate.id === decision.recommended.id && <em>Recommended</em>}</span><ChevronRight size={15} /></button>)}</div>
      </section>

      <section className="card cost-card">
        <div className="card-heading"><h2>Cost Range (Monthly)</h2><span className="evidence-tag">Estimated</span></div>
        <div className="cost-range"><div><span>Low</span><b>{selected.monthlyCost.available ? money(selected.monthlyCost.low) : 'Pending'}</b></div><div className="expected"><span>Expected</span><b>{costValue(selected)}</b></div><div><span>High</span><b>{selected.monthlyCost.available ? money(selected.monthlyCost.high) : 'Pending'}</b></div></div>
        <ul className="cost-lines">{costBreakdown.length ? costBreakdown.map(([label, value]) => <li key={label}><span>{label}</span><b>{moneyDetailed(value)}</b></li>) : <li><span>No priced components</span><b>$0</b></li>}</ul>
        <p className="cost-driver-note">Compute, Database, and Search scale with Peak Requests Per Minute. Storage, Networking, Monitoring, Messaging, and AI token cost scale with Expected Monthly Requests.</p>
      </section>

      <section className="card metrics-card">
        <div className="card-heading"><h2>Measured & Estimated Metrics</h2></div>
        <dl><div title={metricTooltips.latency}><dt>Latency</dt><dd>{latencyValue(selected)}</dd></div><div title={metricTooltips.capacity}><dt>Peak Capacity</dt><dd>{capacityValue(selected)}</dd></div><div title={metricTooltips.availability}><dt>Availability SLA</dt><dd>{availabilityValue(selected)}</dd></div><div title={metricTooltips.headroom}><dt>Scale Headroom</dt><dd>{scaleHeadroom}</dd></div><div title={metricTooltips.requests}><dt>Monthly Requests</dt><dd>{Math.round(decision.profile.monthlyRequestCount).toLocaleString()}</dd></div><div title={metricTooltips.evidence}><dt>Evidence Records</dt><dd>{selected.evidence.length}</dd></div><div title={metricTooltips.updated}><dt>Metrics Updated</dt><dd>{new Date(selected.metricsUpdatedAt).toLocaleDateString()}</dd></div><div title={metricTooltips.platform}><dt>Platform</dt><dd>{selected.platformProvider}</dd></div>{selected.selectedModel && <><div title={metricTooltips.model}><dt>Selected Model</dt><dd>{selected.selectedModel.name}</dd></div><div title={metricTooltips.modelCost}><dt>LLM Token Cost</dt><dd>{money(selected.selectedModel.monthlyCost)}/month</dd></div></>}</dl>
      </section>

      <section className="card risks-card">
        <div className="card-heading"><h2>Derived Risks & Mitigations</h2></div>
        {decision.risks.map(risk => <div className={`risk ${risk.severity.toLowerCase()}`} key={risk.title}><i>{risk.severity === 'Low' ? '✓' : '!'}</i><span><b>{risk.severity}</b><strong>{risk.title}</strong><small><em>Why it matters:</em> {risk.impact}</small><small><em>Next action:</em> {risk.mitigation}</small></span></div>)}
      </section>

      <section className="card next-card">
        <div className="card-heading"><div><h2>Trade-Offs Against Alternatives</h2><p>What this decision gains and gives up</p></div></div>
        {decision.tradeOffs.length ? <div className="tradeoff-list">{decision.tradeOffs.slice(0, 4).map(item => <article key={`${item.dimension}-${item.alternative}`}>
          <h3>{item.dimension}</h3>
          <div className="tradeoff-selected"><b>Selected</b><span>{item.selected}</span></div>
          <div className="tradeoff-rationale"><b>Why</b><span>{item.rationale}</span></div>
          <div className="tradeoff-sacrifice"><b>Give up</b><span>{item.sacrifice}</span></div>
          <footer><b>Alternative</b><span>{item.alternative}</span></footer>
        </article>)}</div> : <div className="tradeoff-empty"><Check size={18} /><div><b>No material trade-off identified</b><span>The selected architecture matches or exceeds eligible alternatives across cost, performance, security, scalability, and simplicity.</span></div></div>}
      </section>
    </div>

    {showEvidence && <section className="evidence-card" id="decision-evidence">
      <div className="trace-heading"><div><span><FileText size={17} /></span><div><h2>Decision Evidence</h2><p>Raw facts supporting the selected architecture and model.</p></div></div><b>{selectedEvidence.length} records</b></div>
      <div className="evidence-scroll"><table><thead><tr><th>Metric</th><th>Value</th><th>Source</th><th>Retrieved</th><th>Confidence</th></tr></thead><tbody>{selectedEvidence.map((item, index) => <tr key={`${item.metric}-${item.sourceUrl}-${index}`}><th>{item.metric}</th><td>{item.value} {item.unit ?? ''}</td><td>{item.sourceUrl?.startsWith('https://') ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName} <ExternalLink size={11} /></a> : <span title={item.sourceUrl}>{item.sourceName} · {item.sourceType}</span>}</td><td>{new Date(item.retrievedAt).toLocaleDateString()}</td><td>{item.confidence}%</td></tr>)}</tbody></table></div>
      <div className="evidence-assumptions"><strong>Cost assumptions</strong>{selected.monthlyCost.assumptions.map(item => <span key={item}>{item}</span>)}</div>
    </section>}

    <section className="decision-trace-card" id="decision-trace">
      <div className="trace-heading"><div><span><ShieldCheck size={17} /></span><div><h2>Decision Trace</h2><p>Requirement → evidence → status</p></div></div><b>{selected.status === 'eligible' ? 'All mandatory gates passed with evidence' : selected.status === 'partiallyEligible' ? `${selected.gates.unknownGates.length} gate(s) missing evidence` : `${selected.gates.failedGates.length} hard gate failures`}</b></div>
      {selected.status !== 'eligible' && <div className="gate-failures">{[...selected.gates.failedGates, ...selected.gates.unknownGates].map(reason => <span key={reason}><X size={13} /> {reason}</span>)}</div>}
      <div className="trace-table"><div className="trace-row header"><b>Requirement</b><b>Evidence</b><b>Status</b></div>{selected.requirementFit.map((row, index) => <div className="trace-row" key={`${row.requirement}-${index}`}><strong>{row.requirement}</strong><span>{row.explanation}</span><b>{`${requirementIcon(row)} ${requirementStatusText(row)}`.trim()}</b></div>)}</div>
    </section>

    <section className="comparison-card">
      <div className="trace-heading"><div><span><Network size={17} /></span><div><h2>Architecture Comparison</h2><p>Eligible and rejected options evaluated against the same requirements.</p></div></div></div>
      <div className="comparison-scroll"><table><thead><tr><th>Architecture</th><th>Status</th><th>Monthly Cost</th><th>P95</th><th>Capacity</th><th>Missing Controls</th><th>Why</th></tr></thead><tbody>{decision.candidates.map(candidate => <tr key={candidate.id} className={candidate.id === decision.recommended.id ? 'recommended-row' : ''}><th>{candidate.name}</th><td className={candidate.status === 'eligible' ? 'pass-value' : candidate.status === 'partiallyEligible' ? '' : 'fail-value'}>{statusText(candidate.status)}</td><td className={candidate.monthlyCost.available && candidate.monthlyCost.expected === Math.min(...eligible.map(item => item.monthlyCost.expected)) ? 'best-value' : ''}>{money(candidate.monthlyCost.expected)}</td><td className={candidate.p95LatencyMs === Math.min(...eligible.map(item => item.p95LatencyMs)) ? 'best-value' : ''}>{latencyValue(candidate)}</td><td>{capacityValue(candidate)}</td><td>{candidate.evaluations.security.missingControls.length}</td><td>{candidate.rankingReason}</td></tr>)}</tbody></table></div>
    </section>

    <footer className="status-bar"><span><ShieldCheck /> {eligible.length} architectures passed mandatory gates</span><span><Check /> Partially eligible: {decision.candidates.filter(candidate => candidate.status === 'partiallyEligible').length}</span><span><b>Catalog:</b> v{decision.catalogVersion} · snapshot {new Date(decision.catalogUpdatedAt).toLocaleDateString()}</span><span><b>Generated:</b> {new Date(decision.generatedAt).toLocaleTimeString()}</span></footer>
  </section>
}