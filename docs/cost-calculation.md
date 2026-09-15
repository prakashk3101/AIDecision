# Cost Calculation

## Contract

Architecture cost is deterministic and evidence-only:

`resource quantity x official unit price = category cost`

`src/resource/resourceEstimator.ts` derives quantities for compute, database, storage, networking, monitoring, security, and workload-dependent messaging, search, or AI resources. Every quantity records its assumption and unit.

`src/cost/costEngine.ts` accepts a price only when all of these match:

- evidence dimension is `cost`
- source type is `official-api`
- provider matches the selected platform
- `metadata.resourceCategory` matches the resource category
- price unit ends with the required resource unit
- value is numeric and has passed evidence validation

There are no platform multipliers, fixed architecture monthly costs, inferred SKUs, or fallback prices.

## Missing Prices

Every required category must have matching official price evidence. If one or more categories are missing, `available` is `false`, the missing categories are listed, the breakdown is empty, and low/expected/high are non-finite internal sentinels rendered as `Unavailable` by the UI and PDF.

An incomplete subtotal is never presented as the architecture's monthly cost.

## Source Configuration

Exact provider service, SKU, region, and unit mappings belong in `collection.pricingQueries` in `server/catalog/decision-catalog.json`. The checked-in query list is intentionally empty. Populate it only from the intended deployment design; the engine does not guess SKUs or regions.

Refresh evidence with `npm run catalog:refresh`. A failed query retains last-known-good evidence and records the failure. A successful refresh does not imply that all categories needed by a workload are priced.

## Model Cost

Model token cost is calculated separately from configured official input, cached-input, and output token prices. It is attached only when a capability-gated model is selected. Model cost must not be used as a substitute for missing architecture resource prices.