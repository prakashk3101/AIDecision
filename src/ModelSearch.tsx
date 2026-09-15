import { useMemo, useState } from 'react'
import { Award, Bot, Calculator, Check, ExternalLink, Filter, Gauge, Search, ShieldCheck, Zap } from 'lucide-react'
import { calculateLLMCost, evaluateModels, modelCatalog, modelScoringWeights, type EvaluatedModel, type ModelScoringWeights, type TokenUsage } from './catalog/modelCatalog'
import { modelRequirementsFor, type DecisionResult } from './domain/decisionEngine'

type SortOption = 'monthlyCost' | 'quality' | 'context' | 'name'

const compact = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const money = (value: number) => value < .01 ? `$${value.toFixed(4)}` : value < 10 ? `$${value.toFixed(2)}` : `$${Math.round(value).toLocaleString()}`

function scoreFactors(item: EvaluatedModel, workload: 'extraction' | 'summarization' | 'rag' | 'agentic', cheapestCost: number, weights: ModelScoringWeights) {
  const cost = item.monthlyCost ? Math.min(100, 100 * cheapestCost / item.monthlyCost) : 100
  return [
    ['Workload quality', item.model.qualityScores[workload], Math.round(weights.workloadQuality * 100)],
    ['Latency', item.model.latencyScore, Math.round(weights.latency * 100)],
    ['Cost efficiency', Math.round(cost), Math.round(weights.costEfficiency * 100)],
    ['Reasoning', item.model.capabilities.reasoning, Math.round(weights.reasoning * 100)],
    ['Security', item.model.securityScore, Math.round(weights.security * 100)],
    ['Reliability', item.model.reliabilityScore, Math.round(weights.reliability * 100)],
  ] as const
}

export default function ModelSearch({ costFocused = false, decision = null, selectedModelId, onSelectModel }: { costFocused?: boolean; decision?: DecisionResult | null; selectedModelId?: string; onSelectModel?: (modelId: string) => void }) {
  const assessmentUsage = decision?.profile.tokenUsage
  const [query, setQuery] = useState('')
  const [host, setHost] = useState('All hosts')
  const [capability, setCapability] = useState('All capabilities')
  const [sort, setSort] = useState<SortOption>('monthlyCost')
  const [requests, setRequests] = useState(assessmentUsage?.requestsPerMonth ?? 100_000)
  const [inputTokens, setInputTokens] = useState(assessmentUsage?.inputTokensPerRequest ?? 1_000)
  const [outputTokens, setOutputTokens] = useState(assessmentUsage?.outputTokensPerRequest ?? 300)
  const [cachePercent, setCachePercent] = useState(assessmentUsage ? Math.round((assessmentUsage.cachedInputTokensPerRequest ?? 0) / assessmentUsage.inputTokensPerRequest * 100) : 0)

  const usage: TokenUsage = {
    requestsPerMonth: requests,
    inputTokensPerRequest: inputTokens,
    outputTokensPerRequest: outputTokens,
    cachedInputTokensPerRequest: inputTokens * cachePercent / 100,
  }
  const hosts = ['All hosts', ...new Set(modelCatalog.flatMap(model => model.hostingProviders))]
  const recommendation = useMemo(() => {
    const selectedModel = decision?.recommended.selectedModel
    if (!decision || !selectedModel) return null
    const requirements = modelRequirementsFor(decision.profile, decision.recommended.platformProvider)
    const ranking = evaluateModels(requirements, decision.profile.tokenUsage)
    const eligible = ranking.filter(item => item.eligible)
    const selected = ranking.find(item => item.model.id === selectedModel.id)
    if (!selected) return null
    const cheapestCost = Math.min(...eligible.map(item => item.monthlyCost))
    return { selected, eligible, requirements, cheapestCost, factors: scoreFactors(selected, requirements.workload, cheapestCost, modelScoringWeights) }
  }, [decision])
  const rows = useMemo(() => modelCatalog.map(model => ({ model, cost: calculateLLMCost(model, usage) })).filter(({ model }) => {
    const searchText = `${model.name} ${model.provider} ${model.hostingProviders.join(' ')}`.toLowerCase()
    if (query && !searchText.includes(query.toLowerCase())) return false
    if (host !== 'All hosts' && !model.hostingProviders.includes(host)) return false
    if (capability === 'Vision' && !model.capabilities.image) return false
    if (capability === 'Audio' && !model.capabilities.audio) return false
    if (capability === 'Video' && !model.capabilities.video) return false
    if (capability === 'Tool calling' && !model.capabilities.toolCalling) return false
    return true
  }).sort((left, right) => sort === 'monthlyCost' ? left.cost.total - right.cost.total : sort === 'quality' ? right.model.capabilities.reasoning - left.model.capabilities.reasoning : sort === 'context' ? right.model.capabilities.contextWindow - left.model.capabilities.contextWindow : left.model.name.localeCompare(right.model.name)), [capability, host, inputTokens, outputTokens, query, requests, cachePercent, sort])
  const cheapest = rows[0]

  return <section className={`workspace model-search-workspace ${costFocused ? 'cost-analysis-workspace' : ''}`}>
    <header className="model-search-header">
      <div><span>VERSIONED MODEL CATALOG</span><h1>{costFocused ? 'AI Model Cost Analysis' : 'AI Model Search'}</h1><p>Compare normalized capabilities and standard on-demand token prices across cloud providers. Prices are a dated planning snapshot, not an account quote.</p></div>
      <div className="catalog-freshness"><ShieldCheck size={17} /><span><b>{modelCatalog.length} deployments</b><small>Pricing checked Aug 28, 2026</small></span></div>
    </header>

    {costFocused && recommendation && <section className="model-recommendation-panel">
      <div className="model-recommendation-summary">
        <div className="recommended-model-heading"><span><Award size={20} /></span><div><small>RECOMMENDED FOR {decision!.profile.name.toUpperCase()}</small><h2>{recommendation.selected.model.name}</h2><p>{recommendation.selected.model.provider} on {decision!.recommended.platformProvider} · {recommendation.requirements.workload.toUpperCase()} workload</p></div></div>
        <div className="recommended-model-score"><strong>{recommendation.selected.score}</strong><span>/100</span><small>Model fit score</small></div>
        <div className="recommended-model-cost"><small>Assessment estimate</small><strong>{money(recommendation.selected.monthlyCost)}<span>/month</span></strong><p>{compact(decision!.profile.tokenUsage.requestsPerMonth)} requests · {compact(decision!.profile.tokenUsage.inputTokensPerRequest)} in / {compact(decision!.profile.tokenUsage.outputTokensPerRequest)} out</p></div>
      </div>
      <div className="model-choice-details">
        <div className="model-choice-reasons"><h3>Why this model was chosen</h3><ul>
          <li><Check size={14} /><span><b>Passes every mandatory gate</b><small>Available on {recommendation.requirements.hostingProvider}, {recommendation.selected.model.capabilities.contextWindow.toLocaleString()}-token context{recommendation.requirements.requiresImage ? ', image input' : ''}{recommendation.requirements.requiresToolCalling ? ', tool calling' : ''}, and structured output.</small></span></li>
          <li><Gauge size={14} /><span><b>Highest deterministic weighted score</b><small>Ranked {recommendation.selected.score}/100 across workload quality, latency, cost efficiency, reasoning, security, and reliability.</small></span></li>
          <li><Zap size={14} /><span><b>Best balance, not simply the cheapest</b><small>{recommendation.eligible.length} models passed. The lowest valid estimate is {money(recommendation.cheapestCost)}/month; quality and operational fit justify the {money(Math.max(0, recommendation.selected.monthlyCost - recommendation.cheapestCost))} premium.</small></span></li>
        </ul></div>
        <div className="model-score-breakdown"><h3>Selection score</h3>{recommendation.factors.map(([label, score, weight]) => <div key={label}><span>{label}<small>{weight}% weight</small></span><div><i style={{ width: `${score}%` }} /></div><b>{score}</b></div>)}</div>
      </div>
      <div className="recommended-comparison"><div className="recommended-comparison-heading"><h3>Recommended vs valid alternatives</h3><span>Choose a model to carry into the final decision.</span></div><div className="recommended-comparison-table"><table><thead><tr><th>Rank</th><th>Model</th><th>Fit score</th><th>Monthly cost</th><th>Cost difference</th><th>Why not selected</th><th>Decision</th></tr></thead><tbody>{recommendation.eligible.slice(0, 5).map((item, index) => { const selected = (selectedModelId ?? recommendation.selected.model.id) === item.model.id; return <tr className={selected ? 'selected' : ''} key={item.model.id}><td>{index + 1}</td><td><strong>{item.model.name}</strong><small>{item.model.provider}</small></td><td><b>{item.score}/100</b></td><td>{money(item.monthlyCost)}</td><td className={item.monthlyCost < recommendation.selected.monthlyCost ? 'saving' : ''}>{item.monthlyCost === recommendation.selected.monthlyCost ? 'Baseline' : `${item.monthlyCost > recommendation.selected.monthlyCost ? '+' : '-'}${money(Math.abs(item.monthlyCost - recommendation.selected.monthlyCost))}`}</td><td>{item.model.id === recommendation.selected.model.id ? <span className="recommended-row-badge"><Check size={11} /> Recommended</span> : item.score < recommendation.selected.score ? `${recommendation.selected.score - item.score} points lower overall fit` : 'Higher estimated cost'}</td><td><button className={`model-select-button ${selected ? 'selected' : ''}`} disabled={selected} onClick={() => onSelectModel?.(item.model.id)}>{selected ? 'Selected' : 'Use model'}</button></td></tr> })}</tbody></table></div></div>
    </section>}

    {costFocused && decision && !recommendation && <section className="model-no-recommendation"><Bot size={19} /><div><h2>No LLM required by this architecture</h2><p>{decision.recommended.name} does not require a generative model. The catalog below remains available for scenario cost exploration.</p></div></section>}

    {costFocused && !decision && <section className="model-no-recommendation"><Bot size={19} /><div><h2>No active assessment</h2><p>Open a saved assessment first to compare its recommended LLM with valid alternatives. The catalog below uses editable planning assumptions.</p></div></section>}

    <section className="model-cost-assumptions">
      <div className="model-section-heading"><Calculator size={18} /><span><h2>Monthly Workload</h2><p>Adjust assumptions to recalculate every model immediately.</p></span></div>
      <div className="model-assumption-grid">
        <label><span>Requests / month</span><input aria-label="Requests per month" type="number" min="1" value={requests} onChange={event => setRequests(Math.max(1, Number(event.target.value)))} /></label>
        <label><span>Input tokens / request</span><input aria-label="Input tokens per request" type="number" min="1" value={inputTokens} onChange={event => setInputTokens(Math.max(1, Number(event.target.value)))} /></label>
        <label><span>Output tokens / request</span><input aria-label="Output tokens per request" type="number" min="1" value={outputTokens} onChange={event => setOutputTokens(Math.max(1, Number(event.target.value)))} /></label>
        <label><span>Cached input</span><div className="cache-control"><input aria-label="Cached input percentage" type="range" min="0" max="100" step="5" value={cachePercent} onChange={event => setCachePercent(Number(event.target.value))} /><b>{cachePercent}%</b></div></label>
      </div>
      <div className="token-summary"><span>{compact(requests * inputTokens)} input tokens</span><span>{compact(requests * outputTokens)} output tokens</span><strong>{cheapest ? `${cheapest.model.name}: ${money(cheapest.cost.total)}/month lowest visible estimate` : 'No matching models'}</strong></div>
    </section>

    <section className="model-catalog-panel">
      <div className="model-toolbar">
        <label className="model-search-box"><Search size={16} /><input aria-label="Search models" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search model, publisher, or cloud" /></label>
        <label><Filter size={14} /><select aria-label="Filter model host" value={host} onChange={event => setHost(event.target.value)}>{hosts.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><select aria-label="Filter capability" value={capability} onChange={event => setCapability(event.target.value)}>{['All capabilities', 'Vision', 'Audio', 'Video', 'Tool calling'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label><select aria-label="Sort models" value={sort} onChange={event => setSort(event.target.value as SortOption)}><option value="monthlyCost">Lowest monthly cost</option><option value="quality">Highest reasoning</option><option value="context">Largest context</option><option value="name">Model name</option></select></label>
      </div>
      <div className="model-results-heading"><div><Bot size={17} /><span><h2>Available Models</h2><p>{rows.length} matching deployments</p></span></div><small>USD per 1M tokens · standard on-demand</small></div>
      <div className={`model-table-wrap ${costFocused ? 'cost-analysis-wrap' : ''}`}><table className={`model-table ${costFocused ? 'cost-analysis-table' : ''}`}><thead><tr><th>Model</th><th>Host</th><th>Capabilities</th><th>Context</th><th>Input</th><th>Cached</th><th>Output</th><th>Monthly estimate</th>{!costFocused && <th>Source</th>}</tr></thead><tbody>{rows.map(({ model, cost }) => <tr key={model.id}>
        <td><strong>{model.name}</strong><small>{model.provider}</small></td>
        <td>{model.hostingProviders.map(item => <span className={`host-badge ${item.toLowerCase().replaceAll(' ', '-')}`} key={item}>{item}</span>)}</td>
        <td><div className="capability-list"><span>Text</span>{model.capabilities.image && <span>Vision</span>}{model.capabilities.audio && <span>Audio</span>}{model.capabilities.video && <span>Video</span>}{model.capabilities.toolCalling && <span>Tools</span>}</div></td>
        <td><b>{compact(model.capabilities.contextWindow)}</b></td>
        <td>{money(model.pricing.inputPer1M)}</td><td>{model.pricing.cachedInputPer1M === undefined ? '—' : money(model.pricing.cachedInputPer1M)}</td><td>{money(model.pricing.outputPer1M)}</td>
        <td><strong className="monthly-model-cost">{money(cost.total)}</strong><small>{money(cost.inputCost + cost.cachedCost)} in · {money(cost.outputCost)} out</small></td>
        {!costFocused && <td><a href={model.pricing.sourceUrl} target="_blank" rel="noreferrer" title={`Open pricing source for ${model.name}`}><ExternalLink size={14} /><span>Pricing</span></a><small>{model.pricing.effectiveDate}</small></td>}
      </tr>)}</tbody></table>{!rows.length && <div className="model-empty">No models match these filters.</div>}</div>
    </section>

    <footer className="model-pricing-note"><b>Estimate boundaries</b><span>Inference tokens only. Excludes regional premiums, provisioned throughput, batch discounts, cache-write/storage, grounding, tools, networking, taxes, and negotiated agreements. Verify availability and billing in the selected cloud account before approval.</span></footer>
  </section>
}
