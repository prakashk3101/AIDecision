import { useEffect, useState } from 'react'
import {
  Bell,
  Bot,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Check,
  FileChartColumn,
  FileText,
  GitCompareArrows,
  Gauge,
  HelpCircle,
  Home,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PlusSquare,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import './App.css'
import ArchitectureDecision from './ArchitectureDecision'
import CostOptimization from './CostOptimization'
import FinalDecision from './FinalDecision'
import ModelSearch from './ModelSearch'
import type { TokenUsage } from './catalog/modelCatalog'
import type { OptimizationScenario } from './cost/tokenOptimizationEngine'
import { loadArchitectureCatalog } from './catalog/catalogClient'
import { applySelectedModel, runDecisionEngine, type DecisionResult, type WorkloadInput, type WorkloadSignals } from './domain/decisionEngine'
import { requestRecommendation } from './recommendation/recommendationClient'
import { evaluateWhatIfScenario, type WhatIfScenario } from './WhatIfSimulator'

const navigation = [
  { label: 'Dashboard', icon: Home },
  { label: 'New Assessment', icon: PlusSquare },
  { label: 'Architectures', icon: Network },
  { label: 'Cost Optimization', icon: CircleDollarSign },
  { label: 'Decide', icon: ShieldCheck },
  { label: 'Assessments', icon: FileText },
  { label: 'AI Model Search', icon: Search },
  { label: 'Compare', icon: GitCompareArrows },
  { label: 'Settings', icon: Settings },
]

const complianceOptions = ['GDPR', 'HIPAA', 'SOC 2', 'ISO 27001', 'FedRAMP', 'PCI DSS']
const securityOptions = ['PII Protection', 'Data Loss Prevention', 'Private Networking', 'Customer-Managed Keys', 'Multi-Factor Authentication']
const statusLabel = (status: 'eligible' | 'partiallyEligible' | 'notEligible') => status === 'eligible' ? 'Eligible' : status === 'partiallyEligible' ? 'Partially eligible' : 'Not eligible'

type Analysis = {
  capabilities: string[]
  workloads: string[]
  assumptions: string[]
  businessGoal: string
  useCase: string
  complexity: number
  security: 'Standard' | 'High' | 'Critical'
  architectureTypes: Array<{ name: string; description: string; confidence: number }>
  signals: WorkloadSignals
  potentialCompliance: string[]
  model?: string
  analyzedAt?: string
}

type AssessmentRecord = {
  id: string
  input: WorkloadInput
  platformOverride?: string
  recommendedArchitecture: string
  status: 'eligible' | 'partiallyEligible' | 'notEligible'
  updatedAt: string
}

const assessmentHistoryKey = 'ai-architect.assessments.v1'

function loadAssessmentHistory() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(assessmentHistoryKey) ?? '[]')
    if (!Array.isArray(stored)) return []
    return stored.flatMap(value => {
      if (!value || typeof value !== 'object') return []
      const record = value as Partial<AssessmentRecord>
      if (typeof record.id !== 'string' || !record.input || typeof record.input.name !== 'string' || typeof record.input.problem !== 'string') return []
      return [{
        id: record.id,
        input: record.input,
        platformOverride: record.platformOverride,
        recommendedArchitecture: record.recommendedArchitecture ?? 'Not yet reassessed',
        status: record.status ?? 'notEligible',
        updatedAt: record.updatedAt ?? new Date(0).toISOString(),
      }]
    })
  } catch {
    return []
  }
}

function AssessmentHistory({ records, onView, onEdit, onReassess }: { records: AssessmentRecord[]; onView: (record: AssessmentRecord) => void; onEdit: (record: AssessmentRecord) => void; onReassess: (record: AssessmentRecord) => void }) {
  return <section className="assessment-history">
    <div className="history-heading"><div><span><CalendarClock size={18} /></span><div><h2>Assessment History</h2><p>Saved in this browser. Reopen requirements or evaluate them with the latest catalog.</p></div></div><b>{records.length} saved</b></div>
    {records.length ? <div className="history-list">{records.map(record => <article key={record.id}>
      <div><strong>{record.input.name}</strong><span>{record.recommendedArchitecture} · {statusLabel(record.status)}</span><small>Updated {new Date(record.updatedAt).toLocaleString()}</small></div>
      <div className="history-actions"><button className="button secondary" onClick={() => onView(record)}>View</button><button className="button secondary" onClick={() => onEdit(record)}>Edit</button><button className="button primary" onClick={() => onReassess(record)}><RefreshCw size={14} /> Reassess</button></div>
    </article>)}</div> : <div className="history-empty"><FileText size={22} /><span>No saved assessments in this browser yet.</span></div>}
  </section>
}

function DashboardArchitectureDiagram() {
  return <section className="dashboard-architecture-card" aria-label="AI Architecture Decision Engine solution architecture">
    <p className="dashboard-architecture-note">Hackathon idea: turn architecture reviews into auditable, evidence-driven decisions with AI-assisted requirements, deterministic gates, cost optimization, and ADR export.</p>
    <img src="/architecture-solution.png" alt="AI Architecture Decision Engine solution architecture" />
  </section>
}

function Dashboard({ records, onNew, onEdit, onViewAll }: { records: AssessmentRecord[]; onNew: () => void; onEdit: (record: AssessmentRecord) => void; onViewAll: () => void }) {
  const evaluations = records.map(record => ({ record, decision: runDecisionEngine(record.input, record.platformOverride) }))
  const analyzed = evaluations.length
  const pricedEvaluations = evaluations.filter(item => item.decision.recommended.monthlyCost.available)
  const unpricedCount = analyzed - pricedEvaluations.length
  const projectedCost = pricedEvaluations.reduce((sum, item) => sum + item.decision.recommended.monthlyCost.expected, 0)
  const potentialSavings = pricedEvaluations.reduce((sum, item) => sum + (item.decision.recommendations.lowestCost.monthlyCost.available ? Math.max(0, item.decision.recommended.monthlyCost.expected - item.decision.recommendations.lowestCost.monthlyCost.expected) : 0), 0)
  const projectedTokens = evaluations.reduce((sum, item) => {
    const usage = item.decision.profile.tokenUsage
    return sum + usage.requestsPerMonth * (usage.inputTokensPerRequest + usage.outputTokensPerRequest)
  }, 0)
  const formatCompact = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

  return <section className="workspace home-dashboard">
    <div className="home-dashboard-heading"><div><h1>Dashboard</h1><p>Monitor assessments, recommendations, projected cost, governance, and AI workload usage.</p></div><button className="button primary" onClick={onNew}><PlusSquare size={16} /> New Assessment</button></div>
    <div className="home-dashboard-grid">
      <article className="home-dashboard-card dashboard-start-card">
        <PlusSquare size={27} /><h2>New Architecture Assessment</h2><p>Describe a business use case and generate ranked architecture options with an auditable decision trace.</p><button className="button" onClick={onNew}>Start Assessment</button>
      </article>
      <article className="home-dashboard-card dashboard-recent-card">
        <div className="dashboard-card-title"><CalendarClock size={20} /><div><h2>Recent Assessments</h2><p>{analyzed} saved in this browser</p></div></div>
        {records.length ? <div className="dashboard-recent-list">{records.slice(0, 3).map(record => <button key={record.id} onClick={() => onEdit(record)}><span><b>{record.input.name}</b><small>{new Date(record.updatedAt).toLocaleDateString()}</small></span><em>{statusLabel(record.status)}</em></button>)}</div> : <p className="dashboard-empty">No assessments yet.</p>}
        <button className="dashboard-link" onClick={onViewAll}>View all assessments <ChevronRight size={15} /></button>
      </article>
      <article className="home-dashboard-card">
        <div className="dashboard-card-title"><CircleDollarSign size={20} /><div><h2>Cost Optimization</h2><p>Deterministic catalog estimates</p></div></div>
        <strong className="dashboard-big-value">{pricedEvaluations.length ? `$${Math.round(projectedCost).toLocaleString()}` : 'Unavailable'}</strong><span className="dashboard-value-label">{pricedEvaluations.length ? 'projected monthly cost' : 'provider prices pending'}</span>
        <p className="dashboard-card-note">{pricedEvaluations.length ? `${pricedEvaluations.length} priced solution(s) · $${Math.round(potentialSavings).toLocaleString()} potential savings${unpricedCount ? ` · ${unpricedCount} pending official provider prices` : ''}.` : `${unpricedCount} assessment(s) await official prices for their selected cloud provider.`}</p>
      </article>
      <article className="home-dashboard-card">
        <div className="dashboard-card-title"><FileChartColumn size={20} /><div><h2>AI Token Consumption</h2><p>Projected monthly architecture workload</p></div></div>
        <strong className="dashboard-big-value">{formatCompact(projectedTokens)} tokens</strong>
        <p className="dashboard-card-note">Calculated from request volume and selected workload token profiles; excludes requirement-analysis API usage.</p>
      </article>
    </div>
    <DashboardArchitectureDiagram />
  </section>
}

function NewAssessment({ initialInput, onGenerate }: { initialInput: WorkloadInput | null; onGenerate: (input: WorkloadInput) => Promise<void> }) {
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(initialInput))
  const [assumptions, setAssumptions] = useState<string[]>(initialInput?.assumptions ?? [])
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [problem, setProblem] = useState(initialInput?.problem ?? 'We need an AI-powered insurance claims solution to process documents, detect fraud, and route complex claims for human approval.')
  const [assessmentName, setAssessmentName] = useState(initialInput?.name ?? 'Insurance Claims Processing')
  const [scale, setScale] = useState(initialInput?.scale ?? 'Enterprise (50K+ users)')
  const [aiRequirement, setAiRequirement] = useState(initialInput?.aiRequirement ?? 'Let AI Determine')
  const [latency, setLatency] = useState(initialInput?.latency ?? 'Under 5 seconds')
  const [sensitivity, setSensitivity] = useState(initialInput?.sensitivity ?? 'High / Confidential')
  const [monthlyRequests, setMonthlyRequests] = useState(initialInput?.monthlyRequests ?? '250K - 500K')
  const [peakRequestsPerMinute, setPeakRequestsPerMinute] = useState(initialInput?.peakRequestsPerMinute ?? '100 - 250')
  const [cloudPreference, setCloudPreference] = useState(initialInput?.cloudPreference ?? 'No preference')
  const [regulatoryRequirements, setRegulatoryRequirements] = useState<string[]>(initialInput?.regulatoryRequirements ?? [])
  const [securityRequirements, setSecurityRequirements] = useState<string[]>(initialInput?.securityRequirements ?? [])
  const [existingTechnology, setExistingTechnology] = useState(initialInput?.existingTechnology ?? '')
  const [integrations, setIntegrations] = useState(initialInput?.integrations ?? '')
  const requiresSourceCitations = initialInput?.requiresSourceCitations ?? null
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analyzedProblem, setAnalyzedProblem] = useState('')
  const [analysisStatus, setAnalysisStatus] = useState<'analyzing' | 'live' | 'unavailable'>('analyzing')
  const [analysisError, setAnalysisError] = useState('')
  const [analysisRevision, setAnalysisRevision] = useState(0)

  const generateArchitecture = async () => {
    if (!analysis || analyzedProblem !== problem || generating) return
    setGenerating(true)
    setGenerationError('')
    try {
      await onGenerate({
        name: assessmentName.trim() || analysis.useCase,
        problem,
        scale,
        aiRequirement,
        latency,
        sensitivity,
        monthlyRequests,
        peakRequestsPerMinute,
        cloudPreference,
        regulatoryRequirements,
        securityRequirements,
        existingTechnology,
        integrations,
        requiresSourceCitations,
        capabilities: analysis.capabilities,
        workloads: analysis.workloads,
        assumptions,
        signals: analysis.signals,
        potentialCompliance: analysis.potentialCompliance,
      })
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Architecture evaluation failed. Please review the requirements and try again.')
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (problem.trim().length < 20) {
      setAnalysis(null)
      setAnalyzedProblem('')
      setAssumptions([])
      setAnalysisStatus('unavailable')
      setAnalysisError('Add more detail to refresh the analysis.')
      return
    }

    const controller = new AbortController()
    let disposed = false
    let timedOut = false
    setAnalysisStatus('analyzing')
    setAnalysisError('')
    const timeout = window.setTimeout(async () => {
      const requestTimeout = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, 30_000)
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ problem }),
          signal: controller.signal,
        })
        const payload: unknown = await response.json()
        if (!response.ok) throw new Error('Live analysis request failed.')
        const nextAnalysis = payload as Analysis
        setAnalysis(nextAnalysis)
        setAnalyzedProblem(problem)
        setAssumptions(nextAnalysis.assumptions)
        setAnalysisStatus('live')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (!disposed && timedOut) {
            setAnalysis(null)
            setAnalysisStatus('unavailable')
            setAnalysisError('Live analysis timed out. Retry the Azure connection.')
          }
          return
        }
        setAnalysis(null)
        setAssumptions([])
        setAnalysisStatus('unavailable')
        setAnalysisError('Live analysis is unavailable. Retry the Azure connection.')
      } finally {
        window.clearTimeout(requestTimeout)
      }
    }, 700)

    return () => {
      disposed = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [problem, analysisRevision])

  return (
    <section className="workspace assessment-workspace">
      <div className="assessment-header">
        <div className="assessment-title"><span>{initialInput ? 'Editing saved assessment' : 'AI-guided assessment'}</span><h1>{initialInput ? 'Edit Architecture Assessment' : 'New Architecture Assessment'}</h1><p>AI analyzes your inputs as you work. Only architecture-significant information is requested.</p></div>
        <div className="autosave"><span /> Draft saved</div>
      </div>

      <div className="assessment-layout">
        <div className="assessment-form">
          <section className="form-section">
            <div className="section-heading"><span>1</span><div><h2>What are you building?</h2><p>Describe the outcome, not the technology.</p></div></div>
            <div className="form-grid two-column">
              <label><span>Assessment Name</span><input value={assessmentName} onChange={event => setAssessmentName(event.target.value)} /></label>
              <label className="wide"><span>Describe your business problem</span><textarea value={problem} onChange={event => setProblem(event.target.value)} rows={5} /></label>
              <label><span>Expected Scale</span><select value={scale} onChange={event => setScale(event.target.value)}><option>Team (under 500 users)</option><option>Business (500-10K users)</option><option>Enterprise (50K+ users)</option></select></label>
              <label><span>AI Requirement</span><select value={aiRequirement} onChange={event => setAiRequirement(event.target.value)}><option>Let AI Determine</option><option>Required</option><option>Not Required</option></select></label>
            </div>
          </section>

          <section className="form-section ai-understanding">
            <div className="section-heading ai-heading"><span><Bot size={16} /></span><div><h2>AI Understanding</h2><p>{analysisStatus === 'live' ? `Analyzed by ${analysis?.model ?? 'Azure AI'}` : 'Updated from your business description'}</p></div>{analysisStatus !== 'unavailable' && <i className={analysisStatus}>{analysisStatus === 'analyzing' ? 'Analyzing' : 'Live'}</i>}</div>
            {analysisError && <div className="analysis-notice"><span>{analysisError}</span><button onClick={() => setAnalysisRevision(value => value + 1)}>Retry</button></div>}
            {analysisStatus === 'live' && analysis && <><div className="understanding-columns">
              <div><h3>Detected Capabilities</h3><ul>{analysis.capabilities.map(item => <li key={item}><Check size={13} />{item}</li>)}</ul></div>
              <div><h3>Detected Workloads</h3><ul>{analysis.workloads.map(item => <li key={item}><Check size={13} />{item}</li>)}</ul></div>
            </div>
            <div className="assumptions"><div><h3>AI assumptions</h3><span>Editable signals used for scoring</span></div><div className="chip-row">{assumptions.map(item => <button key={item} onClick={() => setAssumptions(current => current.filter(value => value !== item))}>{item}<X size={12} /></button>)}<button className="add-chip" onClick={() => !assumptions.includes('Auditability') && setAssumptions([...assumptions, 'Auditability'])}>+ Add</button></div></div></>}
          </section>

          <section className="form-section">
            <div className="section-heading"><span>2</span><div><h2>What matters most?</h2><p>These priorities directly influence architecture scoring.</p></div></div>
            <div className="form-grid priority-grid">
              <label><span>Response Time</span><select value={latency} onChange={event => setLatency(event.target.value)}><option>Under 5 seconds</option><option>Under 10 seconds</option><option>Under 15 seconds</option><option>More than 20 seconds</option></select></label>
              <label><span>Security / Data Sensitivity</span><select value={sensitivity} onChange={event => setSensitivity(event.target.value)}><option>Standard / Internal</option><option>High / Confidential</option><option>Mission Critical / Restricted</option></select></label>
              <label><span>Expected Monthly Requests</span><select value={monthlyRequests} onChange={event => setMonthlyRequests(event.target.value)}><option>Under 100K</option><option>100K - 250K</option><option>250K - 500K</option><option>500K</option><option>1M</option><option>3M</option><option>5M</option><option>10M</option><option>15M</option><option>20M</option></select></label>
              <label><span>Peak Requests Per Minute</span><select value={peakRequestsPerMinute} onChange={event => setPeakRequestsPerMinute(event.target.value)}><option>Under 100</option><option>100 - 250</option><option>250 - 500</option><option>500 - 1,000</option><option>1,000 - 5,000</option><option>More than 5,000</option></select></label>
            </div>
          </section>

          <section className={`form-section advanced-requirements ${advancedOpen ? 'open' : ''}`}>
            <button className="advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}><span><SlidersHorizontal size={17} /><b>Advanced Requirements</b><small>Compliance, security, cloud preference, technology estate and integrations</small></span>{advancedOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
            {advancedOpen && <div className="advanced-content">
              <fieldset className="requirements-group"><legend>Compliance Requirements</legend>{complianceOptions.map(requirement => <label key={requirement}><input type="checkbox" checked={regulatoryRequirements.includes(requirement)} onChange={event => setRegulatoryRequirements(current => event.target.checked ? [...current, requirement] : current.filter(item => item !== requirement))} /> {requirement}</label>)}</fieldset>
              <fieldset className="requirements-group"><legend>Security Requirements</legend>{securityOptions.map(requirement => <label key={requirement}><input type="checkbox" checked={securityRequirements.includes(requirement)} onChange={event => setSecurityRequirements(current => event.target.checked ? [...current, requirement] : current.filter(item => item !== requirement))} /> {requirement}</label>)}</fieldset>
              <label className="advanced-text-field"><span>Cloud Preference</span><select value={cloudPreference} onChange={event => setCloudPreference(event.target.value)}><option>Azure</option><option>AWS</option><option>Google Cloud</option><option>Open source</option><option>No preference</option></select></label>
              <label className="advanced-text-field"><span>Existing Technology</span><textarea rows={3} value={existingTechnology} onChange={event => setExistingTechnology(event.target.value)} placeholder="List your current platforms, applications, and infrastructure" /></label>
              <label className="advanced-text-field"><span>Integrations</span><textarea rows={3} value={integrations} onChange={event => setIntegrations(event.target.value)} placeholder="List systems, APIs, data sources, and external services" /></label>
            </div>}
          </section>

          <section className="form-section copilot-section">
            <div className="copilot-icon"><Bot size={20} /></div><div className="copilot-body"><div className="copilot-title"><div><span>AI Assessment</span><h2>Ready to generate architecture options</h2></div><b>{regulatoryRequirements.length ? '100' : '92'}% complete</b></div><div className="completeness"><i style={{ width: `${regulatoryRequirements.length ? 100 : 92}%` }} /></div>{regulatoryRequirements.length ? <p>All architecture-significant requirements are captured, including {regulatoryRequirements.join(', ')}.</p> : <><p>I have enough information to proceed. One detail could improve recommendation confidence:</p><ul><li>Regulatory requirements</li></ul></>}
              {generating && <div className="generation-flow"><span>Requirements</span><i>→</i><span>Constraints</span><i>→</i><span>Capabilities</span><i>→</i><span>Platforms</span><i>→</i><span>Options</span><i>→</i><span>Recommendation</span></div>}
              {generationError && <div className="analysis-notice"><span>{generationError}</span><button onClick={generateArchitecture}>Retry</button></div>}
              <div className="copilot-actions"><button className="button primary" disabled={!analysis || analyzedProblem !== problem || generating} onClick={generateArchitecture}><Sparkles size={16} /> {generating ? 'Evaluating Candidates…' : 'Generate Architecture'}</button></div>
            </div>
          </section>
        </div>

        <aside className="discovery-panel">
          <div className="discovery-title"><span><Sparkles size={15} /></span><div><h2>AI Discovery</h2><p>Reasoning from your inputs</p></div></div>
          <div className="discovery-item"><small>Business Goal</small><strong>{analysis?.businessGoal ?? 'Awaiting live analysis'}</strong></div>
          <div className="discovery-item"><small>Use Case</small><strong>{analysis?.useCase ?? 'Awaiting live analysis'}</strong></div>
          <div className="discovery-item score"><small>Complexity</small><strong>{analysis ? <>{analysis.complexity}<em>/100</em></> : '—'}</strong><div><i style={{ width: `${analysis?.complexity ?? 0}%` }} /></div></div>
          <div className="discovery-item"><small>Security</small><strong className="high-security"><Shield size={14} /> {analysis?.security ?? 'Awaiting analysis'}</strong></div>
          <div className="architecture-types"><h3>Estimated Architecture Types</h3>{analysis?.architectureTypes.map(type => <div key={type.name}><span><b>{type.name}</b><small>{type.description}</small></span><strong>{type.confidence}%</strong></div>)}</div>
          <div className="neutral-note"><Gauge size={17} /><p>Technology choices remain open until trade-off analysis.</p></div>
        </aside>
      </div>
    </section>
  )
}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [activePage, setActivePage] = useState('Dashboard')
  const [selectedOption, setSelectedOption] = useState('')
  const [decision, setDecision] = useState<DecisionResult | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>()
  const [optimizedTokenUsage, setOptimizedTokenUsage] = useState<TokenUsage | undefined>()
  const [whatIfScenario, setWhatIfScenario] = useState<WhatIfScenario | null>(null)
  const [costOptimizationView, setCostOptimizationView] = useState<'scenario' | 'tokens' | 'models'>('scenario')
  const [history, setHistory] = useState<AssessmentRecord[]>(loadAssessmentHistory)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null)
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    loadArchitectureCatalog()
      .then(() => active && setCatalogState('ready'))
      .catch(() => active && setCatalogState('error'))
    return () => { active = false }
  }, [])

  const storeHistory = (nextHistory: AssessmentRecord[]) => {
    setHistory(nextHistory)
    localStorage.setItem(assessmentHistoryKey, JSON.stringify(nextHistory))
  }

  const openRecord = (record: AssessmentRecord, reassess = false) => {
    const nextDecision = runDecisionEngine(record.input, record.platformOverride)
    setDecision(nextDecision)
    setSelectedModelId(undefined)
    setOptimizedTokenUsage(undefined)
    setWhatIfScenario(null)
    setSelectedOption(nextDecision.recommended.id)
    setCurrentRecordId(record.id)
    setActivePage('Architectures')
    if (reassess) storeHistory(history.map(item => item.id === record.id ? { ...item, recommendedArchitecture: nextDecision.recommended.name, status: nextDecision.recommended.status, updatedAt: nextDecision.generatedAt } : item))
  }

  const editRecord = (record: AssessmentRecord) => {
    setEditingId(record.id)
    setActivePage('New Assessment')
  }

  const generateDecision = async (input: WorkloadInput) => {
    const nextDecision = await requestRecommendation(input)
    const id = editingId ?? crypto.randomUUID()
    const record: AssessmentRecord = { id, input, recommendedArchitecture: nextDecision.recommended.name, status: nextDecision.recommended.status, updatedAt: nextDecision.generatedAt }
    storeHistory([record, ...history.filter(item => item.id !== id)].slice(0, 30))
    setEditingId(null)
    setCurrentRecordId(id)
    setDecision(nextDecision)
    setSelectedModelId(undefined)
    setOptimizedTokenUsage(undefined)
    setWhatIfScenario(null)
    setSelectedOption(nextDecision.recommended.id)
    setActivePage('Architectures')
  }

  const changePlatform = (platform: string) => {
    if (!decision) return
    const nextDecision = runDecisionEngine(decision.profile, platform || undefined)
    setDecision(nextDecision)
    setSelectedModelId(undefined)
    setOptimizedTokenUsage(undefined)
    setWhatIfScenario(null)
    setSelectedOption(current => nextDecision.candidates.some(candidate => candidate.id === current) ? current : nextDecision.recommended.id)
    if (currentRecordId) storeHistory(history.map(item => item.id === currentRecordId ? { ...item, platformOverride: platform || undefined, recommendedArchitecture: nextDecision.recommended.name, status: nextDecision.recommended.status, updatedAt: nextDecision.generatedAt } : item))
  }

  if (catalogState !== 'ready') return <main className="catalog-startup"><section><Network size={24} /><h1>{catalogState === 'loading' ? 'Loading decision catalog' : 'Decision catalog unavailable'}</h1><p>{catalogState === 'loading' ? 'Retrieving the versioned scoring catalog.' : 'The decision engine cannot run without validated architecture, model, platform, and scoring data.'}</p>{catalogState === 'error' && <button className="button primary" onClick={() => window.location.reload()}>Retry</button>}</section></main>

  const scenarioEvaluation = decision && whatIfScenario ? evaluateWhatIfScenario(decision, whatIfScenario) : null
  const effectiveDecision = scenarioEvaluation ? { ...scenarioEvaluation.result, recommended: scenarioEvaluation.selected.candidate } : decision
  const optimizedProfile = effectiveDecision && optimizedTokenUsage ? { ...effectiveDecision.profile, tokenUsage: optimizedTokenUsage } : effectiveDecision?.profile
  const modelAdjustedDecision = effectiveDecision && optimizedProfile && (selectedModelId || optimizedTokenUsage)
    ? { ...effectiveDecision, profile: optimizedProfile, recommended: applySelectedModel(effectiveDecision.recommended, optimizedProfile, selectedModelId ?? effectiveDecision.recommended.selectedModel?.id) }
    : effectiveDecision
  const applyOptimization = (scenario: OptimizationScenario, usage: TokenUsage) => {
    setOptimizedTokenUsage(usage)
    setSelectedModelId(scenario.model.id)
  }
  const applyScenario = (scenario: WhatIfScenario) => {
    setWhatIfScenario(scenario)
    setOptimizedTokenUsage(undefined)
  }

  return (
    <div className={`app-shell ${collapsed ? 'nav-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Network size={22} /></span>
          {!collapsed && <div><strong>AI ARCHITECT</strong><span>Architecture Decision Engine</span></div>}
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X /></button>
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} title={collapsed ? label : undefined} onClick={() => { if (['Dashboard', 'New Assessment', 'Assessments', 'Architectures', 'Compare', 'Cost Optimization', 'AI Model Search', 'Decide'].includes(label)) { if (label === 'New Assessment') setEditingId(null); setActivePage(label) } setMobileNav(false) }}>
              <Icon size={18} />{!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item collapse-button" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Collapse menu</span>}
          </button>
          <div className="profile">
            <span className="avatar">AM</span>
            {!collapsed && <div><strong>Meenakshi Sundaram</strong><span>Solution Architect</span></div>}
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button>
          <div className="breadcrumbs"><span>{activePage === 'Dashboard' ? 'Overview' : activePage === 'AI Model Search' ? 'Model Catalog' : activePage === 'Cost Optimization' ? 'Optimization' : activePage === 'Decide' ? 'Final Decision' : 'Assessments'}</span><ChevronRight size={14} /><span>{activePage === 'Dashboard' ? 'Dashboard' : activePage === 'New Assessment' ? 'New Architecture Assessment' : activePage === 'AI Model Search' || activePage === 'Cost Optimization' || activePage === 'Decide' ? activePage : decision?.profile.name ?? 'Insurance Claims Processing'}</span><b>{activePage === 'Dashboard' ? `${history.length} saved` : activePage === 'New Assessment' ? 'Draft' : activePage === 'Decide' ? 'Final' : activePage === 'AI Model Search' || activePage === 'Cost Optimization' ? 'Current' : activePage === 'Architectures' ? 'Evaluated' : 'In Progress'}</b></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search"><Search /></button>
            <button className="icon-button notification" aria-label="Notifications"><Bell /><i>3</i></button>
            <button className="icon-button" aria-label="Help"><HelpCircle /></button>
            <span className="avatar small">AM</span>
          </div>
        </header>

        {activePage === 'Dashboard' ? <Dashboard records={history} onNew={() => { setEditingId(null); setActivePage('New Assessment') }} onEdit={editRecord} onViewAll={() => setActivePage('Assessments')} /> : activePage === 'New Assessment' ? <NewAssessment key={editingId ?? 'new'} initialInput={history.find(record => record.id === editingId)?.input ?? null} onGenerate={generateDecision} /> : activePage === 'Assessments' ? <section className="workspace history-workspace"><AssessmentHistory records={history} onView={openRecord} onEdit={editRecord} onReassess={record => openRecord(record, true)} /></section> : activePage === 'AI Model Search' ? <ModelSearch decision={modelAdjustedDecision} /> : activePage === 'Cost Optimization' && effectiveDecision ? <CostOptimization decision={effectiveDecision} modelDecision={modelAdjustedDecision} view={costOptimizationView} onViewChange={setCostOptimizationView} onScenarioApply={applyScenario} selectedModelId={selectedModelId} onSelectModel={setSelectedModelId} onApplyOptimization={applyOptimization} /> : activePage === 'Decide' && decision ? <FinalDecision decision={decision} scenario={whatIfScenario} selectedModelId={selectedModelId} optimizedTokenUsage={optimizedTokenUsage} /> : decision ? <ArchitectureDecision decision={decision} selectedId={selectedOption} onSelect={setSelectedOption} onPlatformChange={changePlatform} onEdit={() => { const record = history.find(item => item.id === currentRecordId); if (record) editRecord(record) }} showWhatIf={false} compareMode={activePage === 'Compare'} onWhatIfChange={show => { if (show) { setCostOptimizationView('scenario'); setActivePage('Cost Optimization') } }} onScenarioApply={applyScenario} /> : <section className="workspace assessment-landing">
          <div className="assessment-intro">
            <span className="eyebrow"><Sparkles size={14} /> No generated architecture</span>
            <h1>Create an architecture assessment</h1>
            <p>Architecture diagrams, recommendations, scores, costs, and options are generated from your assessment requirements.</p>
            <button className="button primary" onClick={() => setActivePage('New Assessment')}>Start New Assessment <ChevronRight size={15} /></button>
          </div>
        </section>}
      </main>
    </div>
  )
}

export default App
