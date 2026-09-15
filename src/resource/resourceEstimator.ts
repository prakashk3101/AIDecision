export type ResourceCategory = 'compute' | 'database' | 'storage' | 'networking' | 'messaging' | 'search' | 'ai' | 'monitoring' | 'security'

export type ResourceRequirement = {
  category: ResourceCategory
  quantity: number
  unit: string
  assumptions: string[]
}

export type ResourceRequirements = {
  provider?: string
  region?: string
  resources: ResourceRequirement[]
  assumptions: string[]
}

export type ResourceWorkload = {
  monthlyRequestCount: number
  peakRequestsPerSecond: number
  requiresAI: boolean
  requiresGenAI: boolean
  signals: { documentProcessing: boolean; knowledgeRetrieval: boolean; eventStreaming: boolean }
  sensitivity: string
  availabilityTargetPercent: number
}

export type ArchitectureResourceProfile = {
  name: string
  serviceCount: number
  integrationPoints: number
  deploymentUnits: number
  statefulComponents: number
}

const hoursPerMonth = 730

export function estimateResources(workload: ResourceWorkload, provider?: string, region?: string, architecture?: ArchitectureResourceProfile): ResourceRequirements {
  const availabilityUnits = workload.availabilityTargetPercent >= 99.99 ? 3 : workload.availabilityTargetPercent >= 99.9 ? 2 : 1
  const demandComputeUnits = Math.max(1, Math.ceil(workload.peakRequestsPerSecond / 100))
  const computeUnits = Math.max(demandComputeUnits, architecture?.deploymentUnits ?? 1) * availabilityUnits
  const databaseUnits = Math.max(1, architecture?.statefulComponents ?? 1) * availabilityUnits
  const networkingFactor = Math.max(1, (architecture?.integrationPoints ?? 1) / 4)
  const monitoringFactor = Math.max(1, (architecture?.serviceCount ?? 1) / 4)
  const searchPartitions = Math.max(1, Math.ceil(workload.peakRequestsPerSecond / 100))
  const storageGb = Math.max(1, Math.ceil(workload.monthlyRequestCount / 10_000))
  const resources: ResourceRequirement[] = [
    { category: 'compute', quantity: computeUnits * hoursPerMonth, unit: 'instance-hour', assumptions: [`Compute floor is the greater of traffic demand and ${architecture?.name ?? 'architecture'} deployment units`, `${availabilityUnits} availability replicas for ${workload.availabilityTargetPercent}% availability`] },
    { category: 'database', quantity: databaseUnits * hoursPerMonth, unit: 'database-hour', assumptions: ['Managed databases bill per provisioned hour, not per request', `${architecture?.statefulComponents ?? 1} stateful component(s) across ${availabilityUnits} availability replicas`] },
    { category: 'storage', quantity: storageGb, unit: 'GB-month', assumptions: ['One GB per 10,000 monthly requests'] },
    { category: 'networking', quantity: Math.max(1, workload.monthlyRequestCount / 100_000) * networkingFactor, unit: 'GB', assumptions: [`Network usage scales with ${architecture?.integrationPoints ?? 1} architecture integration point(s)`] },
    { category: 'monitoring', quantity: Math.max(1, workload.monthlyRequestCount / 1_000) * monitoringFactor, unit: '1K-events', assumptions: [`Telemetry scales with ${architecture?.serviceCount ?? 1} architecture service(s)`] },
    { category: 'security', quantity: computeUnits * hoursPerMonth, unit: 'protected-instance-hour', assumptions: [`Security coverage follows deployed compute units for ${workload.sensitivity} data`] },
  ]
  if (workload.signals.eventStreaming) resources.push({ category: 'messaging', quantity: workload.monthlyRequestCount, unit: 'operation', assumptions: ['One messaging operation per request'] })
  if (workload.signals.knowledgeRetrieval) resources.push({ category: 'search', quantity: searchPartitions * availabilityUnits * hoursPerMonth, unit: 'search-unit-hour', assumptions: [`${searchPartitions} search partition(s) sized at 100 peak queries/second`, `${availabilityUnits} search replica(s) for ${workload.availabilityTargetPercent}% availability`] })
  // AI cost is not taken from an infrastructure meter; it is calculated from published model token pricing.
  return { provider, region, resources, assumptions: resources.flatMap(resource => resource.assumptions) }
}