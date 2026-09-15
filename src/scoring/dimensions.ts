export const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export function thresholdScore(actual: number, required: number) {
  if (actual <= required) return 100
  return clampScore(required / actual * 100)
}

export function capacityScore(available: number, required: number) {
  if (available >= required) return 100
  return clampScore(available / Math.max(1, required) * 100)
}

export function capabilityScore(required: boolean, supported: boolean) {
  if (!required) return 100
  return supported ? 100 : 0
}

export function availabilityScore(availablePercent: number, requiredPercent: number) {
  if (availablePercent >= requiredPercent) return 100
  const availableDowntime = Math.max(.0001, 100 - availablePercent)
  const requiredDowntime = Math.max(.0001, 100 - requiredPercent)
  return clampScore(requiredDowntime / availableDowntime * 100)
}