import type { ScoreDimension, ScoreWeights } from './weights.js'

export type ArchitectureScorecard = Record<ScoreDimension, number>

export function calculateOverallScore(scores: ArchitectureScorecard, weights: ScoreWeights) {
  return Math.round((Object.keys(weights) as ScoreDimension[]).reduce((total, dimension) => total + scores[dimension] * weights[dimension] / 100, 0))
}