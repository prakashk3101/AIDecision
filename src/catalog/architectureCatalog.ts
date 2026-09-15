import type { Evidence } from './modelCatalog.js'
import type { LatencyFormula } from '../performance/latencyModel.js'

export type ArchitectureCapabilities = {
  ai: boolean
  genAI: boolean
  multimodal: boolean
  toolCalling: boolean
  humanReview: boolean
  realTime: boolean
  streaming: boolean
  sourceCitations: boolean
  predictiveScoring: boolean
  documentProcessing: boolean
  knowledgeRetrieval: boolean
  workflowOrchestration: boolean
}

export type ArchitectureOperations = {
  serviceCount: number
  integrationPoints: number
  deploymentUnits: number
  statefulComponents: number
}

export type ArchitectureCatalogEntry = {
  id: string
  name: string
  pattern: string
  description: string
  components: string[]
  strengths: string[]
  weaknesses: string[]
  capabilities: ArchitectureCapabilities
  operations: ArchitectureOperations
  latencyFormula: LatencyFormula
  liveMetrics: {
    pricing: { baseMonthlyCost: number; requestCost: number }
    performance: { p95LatencyMs: number; maxRequestsPerSecond: number }
    availability: { targetPercent: number }
    benchmark: { source: string; measuredAt: string }
  }
  security: { score: number; controls: string[] }
  complexityPenalty: number
  maintainability: number
  operationalFit: number
  evidence: Evidence[]
  metadata: { version: string; lastUpdated: string; status: 'active' | 'deprecated' | 'experimental' }
}

export const architectureCatalog: ArchitectureCatalogEntry[] = []

export function hydrateArchitectureCatalog(entries: ArchitectureCatalogEntry[]) {
  architectureCatalog.splice(0, architectureCatalog.length, ...entries)
  return architectureCatalog
}
