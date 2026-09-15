import type { Evidence } from '../catalog/modelCatalog.js'

export type SecurityRequirement = { control: string; label: string; weight: number }
export type SecurityControlStatus = 'met' | 'notMet' | 'unknown'
export type SecurityEvaluation = { supportedWeight: number; requiredWeight: number; score: number | null; confidence: number; missingControls: string[]; documentedControls: string[]; controlStatus: Record<string, SecurityControlStatus>; evidenceIds: string[]; unavailableReason?: string }

const matches = (evidence: Evidence[], control: string) => evidence.filter(item => item.metric.toLowerCase().includes(control.toLowerCase()))
const supports = (evidence: Evidence[], control: string) => matches(evidence, control).some(item => String(item.value).toLowerCase() === 'true')

export function evaluateSecurity(requirements: SecurityRequirement[], evidence: Evidence[]): SecurityEvaluation {
  if (!requirements.length) return { supportedWeight: 0, requiredWeight: 0, score: null, confidence: 0, missingControls: [], documentedControls: [], controlStatus: {}, evidenceIds: [], unavailableReason: 'No security controls were specified' }
  const all = evidence.filter(item => item.dimension === 'security')
  const usable = all.filter(item => item.sourceType !== 'expert-rule' && item.sourceType !== 'assumption')
  // Status is resolved per control: absence of authoritative evidence is unknown, never unsupported.
  const controlStatus = Object.fromEntries(requirements.map(requirement => [
    requirement.control,
    matches(usable, requirement.control).length ? (supports(usable, requirement.control) ? 'met' : 'notMet') : 'unknown',
  ])) as Record<string, SecurityControlStatus>
  const documentedControls = requirements.filter(requirement => supports(all, requirement.control)).map(item => item.control)
  const supported = requirements.filter(requirement => controlStatus[requirement.control] === 'met')
  const requiredWeight = requirements.reduce((sum, item) => sum + item.weight, 0)
  const supportedWeight = supported.reduce((sum, item) => sum + item.weight, 0)
  const missingControls = requirements.filter(item => controlStatus[item.control] === 'notMet').map(item => item.control)
  if (!usable.length) return { supportedWeight: 0, requiredWeight, score: null, confidence: 0, missingControls, documentedControls, controlStatus, evidenceIds: [], unavailableReason: 'No documented security control evidence' }
  return { supportedWeight, requiredWeight, score: Math.round(supportedWeight / requiredWeight * 100), confidence: Math.round(usable.reduce((sum, item) => sum + item.confidence, 0) / usable.length), missingControls, documentedControls, controlStatus, evidenceIds: usable.map(item => item.id) }
}