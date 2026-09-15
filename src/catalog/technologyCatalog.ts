export type PlatformCatalog = Record<string, Record<string, string>>

export const platformCatalog: PlatformCatalog = {}
export const technologyCatalog: Array<{ provider: string; services: Record<string, string>; evidenceDate: string }> = []

export function hydrateTechnologyCatalog(platforms: PlatformCatalog, evidenceDate: string) {
  for (const provider of Object.keys(platformCatalog)) delete platformCatalog[provider]
  Object.assign(platformCatalog, platforms)
  technologyCatalog.splice(0, technologyCatalog.length, ...Object.entries(platforms).map(([provider, services]) => ({ provider, services, evidenceDate })))
}
