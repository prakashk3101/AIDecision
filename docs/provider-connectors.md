# Provider Connectors

## Configuration

Pricing queries live in `collection.pricingQueries` in `server/catalog/decision-catalog.json`. Every query requires an explicit provider, service, SKU, region, and stable query ID. Do not guess broad service labels or SKUs.

## Azure

`server/evidence/azurePricingCollector.ts` reads the Azure Retail Prices API, follows pagination, and filters exact SKU, service, region, and price type. It requires no browser credential.

## AWS

`server/evidence/awsPricingCollector.ts` uses AWS Price List `GetProducts` and the standard AWS credential chain. Exact SKU and region configuration are required.

## Google Cloud

`server/evidence/googlePricingCollector.ts` resolves Cloud Billing services and pages their SKUs. Configure a server-side access token or API key. Exact SKU and region filtering still applies.

## Official Documents

`server/evidence/officialDocumentCollector.ts` verifies configured HTTPS SLA and capability sources and records retrieval metadata. It does not infer arbitrary metrics from prose.

## Refresh

Run `npm run catalog:refresh`. Set `EVIDENCE_PROVIDER` to refresh one provider. Search indexing is enabled only when `AZURE_SEARCH_ENDPOINT` and `AZURE_SEARCH_EVIDENCE_INDEX` are configured. A failed query retains its prior facts and is listed in refresh output.
