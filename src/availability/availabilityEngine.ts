import type { Evidence } from '../catalog/modelCatalog.js'
import { availabilityScore } from '../scoring/dimensions.js'

export type AvailabilityEvaluation = { slaPercent: number | null; estimatedSlaPercent: number | null; multiZoneSupport: boolean | null; multiRegionSupport: boolean | null; score: number | null; confidence: number; evidenceIds: string[]; unavailableReason?: string }

const slaRecord = (evidence: Evidence[]) => evidence.find(item => item.metric === 'availability.slaPercent' && typeof item.value === 'number')

export function evaluateAvailability(requiredPercent: number, evidence: Evidence[]): AvailabilityEvaluation {
  const all = evidence.filter(item => item.dimension === 'availability')
  const usable = all.filter(item => item.sourceType !== 'expert-rule' && item.sourceType !== 'assumption')
  const sla = slaRecord(usable)
  const multiZone = usable.find(item => item.metric === 'availability.multiZoneSupport' && /^(true|false)$/i.test(String(item.value)))
  const multiRegion = usable.find(item => item.metric === 'availability.multiRegionSupport' && /^(true|false)$/i.test(String(item.value)))
  // The catalog SLA is still surfaced as an estimate so the requirement is never blank.
  const estimatedSlaPercent = (slaRecord(all)?.value as number | undefined) ?? null
  if (!sla) return { slaPercent: null, estimatedSlaPercent, multiZoneSupport: null, multiRegionSupport: null, score: null, confidence: 0, evidenceIds: [], unavailableReason: 'No applicable official SLA evidence' }
  return {
    slaPercent: sla.value as number, estimatedSlaPercent, multiZoneSupport: multiZone ? String(multiZone.value).toLowerCase() === 'true' : null,
    multiRegionSupport: multiRegion ? String(multiRegion.value).toLowerCase() === 'true' : null,
    score: availabilityScore(sla.value as number, requiredPercent), confidence: Math.round(usable.reduce((sum, item) => sum + item.confidence, 0) / usable.length), evidenceIds: usable.map(item => item.id),
  }
}