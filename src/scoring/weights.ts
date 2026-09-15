export type ScoreDimension = 'architectureFit' | 'performance' | 'security' | 'scalability' | 'costEfficiency' | 'availability' | 'aiFit' | 'complexity' | 'maintainability' | 'operationalFit'

export type ScoreWeights = Record<ScoreDimension, number>

export const defaultWeights = {} as ScoreWeights

export function hydrateDefaultWeights(weights: ScoreWeights) {
  for (const dimension of Object.keys(defaultWeights)) delete defaultWeights[dimension as ScoreDimension]
  Object.assign(defaultWeights, weights)
}

export function normalizeWeights(requested: Partial<ScoreWeights>): ScoreWeights {
  const merged = { ...defaultWeights, ...requested }
  const total = Object.values(merged).reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (!total) return { ...defaultWeights }
  return Object.fromEntries(Object.entries(merged).map(([dimension, weight]) => [dimension, Math.max(0, weight) * 100 / total])) as ScoreWeights
}
