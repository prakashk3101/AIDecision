import type { EvidenceType } from '../catalog/modelCatalog.js'

export type LatencyComponent = { name: string; p95Ms: number }

export type LatencyFormula = {
  components: LatencyComponent[]
  modelMultiplier: number
  sourceType: EvidenceType
  sourceUrl: string
  measuredAt: string
}

// Mirrors the metric shape published by model benchmark providers: time to first token plus
// decode time at a measured output speed. End-to-end time is derived, never stored.
export type ModelLatencyInput = {
  id: string
  ttftMs: number
  outputTokensPerSecond: number
  sourceType: EvidenceType
}

export type LatencyComposition = {
  p95Ms: number
  overheadMs: number
  modelMs: number | null
  modelTtftMs: number | null
  modelDecodeMs: number | null
  outputTokens: number
  modelId?: string
  breakdown: LatencyComponent[]
  sourceType: EvidenceType
}

// Ordered strongest to weakest; a composed estimate is only as strong as its weakest input.
const strength: EvidenceType[] = ['official-api', 'official-sla', 'official-documentation', 'independent-benchmark', 'internal-benchmark', 'expert-rule', 'assumption']
const weakest = (left: EvidenceType, right: EvidenceType) => (strength.indexOf(left) >= strength.indexOf(right) ? left : right)

export function modelResponseTimeMs(model: ModelLatencyInput, outputTokens: number) {
  const decodeMs = model.outputTokensPerSecond > 0 ? outputTokens / model.outputTokensPerSecond * 1000 : 0
  return { ttftMs: model.ttftMs, decodeMs, totalMs: model.ttftMs + decodeMs }
}

export function composeLatency(formula: LatencyFormula, model?: ModelLatencyInput, outputTokens = 0): LatencyComposition {
  const overheadMs = formula.components.reduce((total, component) => total + component.p95Ms, 0)
  const response = model ? modelResponseTimeMs(model, outputTokens) : null
  const ttftMs = response ? Math.round(response.ttftMs * formula.modelMultiplier) : null
  const decodeMs = response ? Math.round(response.decodeMs * formula.modelMultiplier) : null
  const modelMs = ttftMs !== null && decodeMs !== null ? ttftMs + decodeMs : null
  return {
    p95Ms: overheadMs + (modelMs ?? 0),
    overheadMs,
    modelMs,
    modelTtftMs: ttftMs,
    modelDecodeMs: decodeMs,
    outputTokens,
    modelId: model?.id,
    breakdown: [
      ...formula.components,
      ...(model && ttftMs !== null && decodeMs !== null
        ? [
          { name: `${model.id} time to first token`, p95Ms: ttftMs },
          { name: `${model.id} output (${outputTokens} tokens @ ${model.outputTokensPerSecond} tok/s)`, p95Ms: decodeMs },
        ]
        : []),
    ],
    sourceType: model ? weakest(formula.sourceType, model.sourceType) : formula.sourceType,
  }
}

export function describeComposition(composition: LatencyComposition) {
  return composition.breakdown.map(component => `${component.name} ${component.p95Ms}ms`).join(' + ')
}
