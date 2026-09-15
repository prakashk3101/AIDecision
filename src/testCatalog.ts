import catalog from '../server/catalog/decision-catalog.json'
import { hydrateDecisionCatalog, type DecisionCatalog } from './catalog/catalogClient'

export function hydrateTestCatalog() {
  return hydrateDecisionCatalog(catalog as unknown as DecisionCatalog)
}