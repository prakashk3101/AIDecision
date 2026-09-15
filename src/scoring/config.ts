export type RuntimeScoringConfig = {
  microservicesFit: { explicitRequirementCap: number; keywords: string[] }
  derivation: {
    complexity: { serviceCountMaximum: number; integrationPointsMaximum: number; deploymentUnitsMaximum: number; stateAndDependencyMaximum: number; factorWeight: number }
    maintainability: { complexityWeight: number; automationWeight: number; observabilityWeight: number; runbookWeight: number; baselineAdjustment: number }
    model: { latencyTargetMs: number; latencyMsPerPenaltyPoint: number; availabilityBaselinePercent: number; availabilityPointsPerPercent: number; errorRatePenalty: number }
  }
  confidence: {
    sourceReliability: Record<string, number>
    factors: { sourceReliability: number; freshness: number; measurementQuality: number; applicability: number }
    staleAfterDays: number
    minimumFreshness: number
    assumptionPenalty: number
    evidenceWeight: number
    requirementWeight: number
    stabilityWeight: number
  }
}

export const scoringConfig = {} as RuntimeScoringConfig

export function hydrateScoringConfig(config: RuntimeScoringConfig) {
  Object.assign(scoringConfig, config)
}