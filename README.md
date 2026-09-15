# AI Architecture Decision Engine

## What Is This Use Case?

Enterprise architects must turn incomplete business requirements into defensible technology decisions while balancing capability, security, scalability, performance, reliability, and cost. That process is often manual, difficult to reproduce, and disconnected from current provider evidence.

The AI Architecture Decision Engine provides one workspace to:

1. Describe a business problem and its operational constraints.
2. Extract architecture-significant requirements with Azure AI.
3. Evaluate architecture patterns through deterministic gates and scoring.
4. Compare eligible technologies and AI models using versioned evidence.
5. Estimate infrastructure and token costs and test what-if scenarios.
6. Record the final decision as an auditable PDF Architecture Decision Record (ADR).

AI extracts requirements and explains results; it does not select the winning architecture. The deterministic engine makes that decision so the recommendation remains reproducible from the inputs and catalog snapshot.

## Architecture

![AI Architecture Decision Engine solution architecture]
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/ab864dfe-9c32-4bda-9553-3b6d73da8100" />


The solution has three logical layers:

- **Decision workspace:** A React and TypeScript browser application captures assessments and presents recommendations, comparisons, cost optimization, model selection, and ADR export.
- **Application and decision services:** Vite/Node middleware exposes same-origin APIs, obtains Microsoft Entra tokens, invokes Azure AI, and runs the deterministic decision, scoring, cost, security, performance, and confidence engines.
- **Evidence layer:** The versioned JSON catalog contains architecture, model, technology, pricing, benchmark, and source evidence. Optional Azure AI Search provides validated evidence overlays without becoming a dependency for core recommendations.

The browser sends the business problem to `/api/analyze`. Server-side middleware calls the configured Azure AI model using `DefaultAzureCredential`; no API key or access token is stored in or returned to the browser. The structured analysis then enters the deterministic recommendation engine, where mandatory gates run before candidate scoring and ranking.

## How To Run

### Prerequisites

- Node.js 22 and npm
- Azure CLI
- Access to an Azure AI model deployment
- The `Cognitive Services OpenAI User` role on the Azure AI resource

Install dependencies and authenticate:

```bash
npm ci
az login
```

If needed, select the subscription containing the Azure AI resource:

```bash
az account set --subscription <subscription-id>
```

Copy `.env.example` to `.env` only when you need to change the default non-secret endpoint, deployment, or API version. Do not put an API key or access token in this file.

Start the application:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## Capabilities

- AI-assisted extraction of capabilities, workloads, assumptions, and compliance signals
- Gate-first architecture evaluation against functional and non-functional requirements
- Ranked architecture and technology alternatives with an auditable decision trace
- Model comparison based on capability, quality, performance, reliability, and cost evidence
- What-if analysis for scale, latency, security, cloud preference, and workload changes
- Infrastructure and token-cost optimization scenarios
- Interactive solution diagrams, scorecards, risks, trade-offs, and delivery roadmaps
- PDF ADR generation and browser-local assessment history
- Optional Azure AI Search evidence overlays
- Provider pricing refresh and workload benchmarking tools

## How It Works

1. Describe the business outcome and operational constraints.
2. Azure AI extracts structured architecture-significant requirements.
3. The deterministic engine applies mandatory capability and non-functional gates.
4. Eligible candidates are scored using the versioned evidence catalog.
5. The workspace presents recommendations, alternatives, cost, risks, and evidence.
6. Architects can run what-if scenarios, select a model, and export the final ADR.

The browser calls same-origin middleware APIs. Azure credentials and model access tokens remain in the server process and are never returned to the browser.

## Technology

- React 18 and TypeScript
- Vite development and production preview server
- Vitest
- Azure Identity with `DefaultAzureCredential`
- Azure OpenAI-compatible chat completions endpoint
- Optional Azure AI Search evidence store
- AWS and Google Cloud pricing SDK/API integrations
- jsPDF for ADR export

## Authentication

The application does not require an Azure OpenAI API key. Server-side middleware uses `DefaultAzureCredential` to request a short-lived Microsoft Entra token for `https://cognitiveservices.azure.com/.default` and sends that token to Azure AI as a bearer token.

- Local development uses credentials from Azure CLI, VS Code, or another supported developer credential.
- Azure App Service uses its system-assigned managed identity.
- The runtime identity must have the `Cognitive Services OpenAI User` role on the target Azure AI resource.
- Endpoint URLs, deployment names, API versions, subscription IDs, and resource names are identifiers, not credentials.

Never commit `.env` files, API keys, access tokens, client secrets, or connection strings.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure AI resource endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | Deployed model name |
| `AZURE_OPENAI_API_VERSION` | Yes | Azure OpenAI-compatible API version |
| `AZURE_SEARCH_ENDPOINT` | No | Azure AI Search endpoint for evidence indexing and retrieval |
| `AZURE_SEARCH_EVIDENCE_INDEX` | No | Existing evidence index name |
| `EVIDENCE_PROVIDER` | No | Limits refresh to `Azure`, `AWS`, or `Google Cloud` |
| `GOOGLE_CLOUD_ACCESS_TOKEN` | No | Google Cloud Billing authentication for catalog refresh |
| `GOOGLE_CLOUD_API_KEY` | No | Alternative Google Cloud Billing authentication |
| `BENCHMARK_ARCHITECTURE_ID` | For benchmarks | Catalog architecture identifier |
| `BENCHMARK_URL` | For benchmarks | Target workload health or benchmark endpoint |
| `BENCHMARK_AUTHORIZATION` | No | Authorization value for a protected benchmark target |

Additional benchmark controls are available in `.env.example` and `scripts/runArchitectureBenchmark.ts`.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite server |
| `npm run build` | Type-check and create the production build |
| `npm run lint` | Run the TypeScript validation build |
| `npm test` | Run the complete Vitest suite once |
| `npm run catalog:refresh` | Refresh configured pricing and official evidence |
| `npm run benchmark:architecture` | Benchmark a deployed architecture target |
| `npm start` | Serve the production build on the configured `PORT` |

## Validation

Run the checks used to validate the application:

```bash
npm run lint
npm test
npm run build
```

## Evidence Catalog

`server/catalog/decision-catalog.json` is the versioned source for architecture patterns, models, technologies, scoring coefficients, pricing observations, benchmarks, and supporting evidence. Runtime hydration derives normalized security, complexity, maintainability, operational readiness, quality, latency, and reliability scores.

Refresh configured public evidence sources with:

```bash
npm run catalog:refresh
```

The refresh process supports the Azure Retail Prices API, AWS Price List API, Google Cloud Billing Catalog API, and configured official documentation sources. Add exact service, SKU, and region queries under `collection.pricingQueries`; the engine intentionally does not guess deployment SKUs or substitute prices across providers.

AWS uses the standard AWS SDK credential chain. Google Cloud requires `GOOGLE_CLOUD_ACCESS_TOKEN` or `GOOGLE_CLOUD_API_KEY`. Failed queries retain prior facts and are recorded in `collectedEvidence.failures`; catalog writes are atomic.

When `AZURE_SEARCH_ENDPOINT` and `AZURE_SEARCH_EVIDENCE_INDEX` are configured, normalized evidence is indexed using `DefaultAzureCredential`. The index must already exist and match the contract documented in `docs/azure-ai-search-index.md`.

Checked-in operational observations are seed baselines. Replace them with region-specific load tests and service-specific sources before using recommendations as production evidence.

## Benchmarking

Configure `BENCHMARK_ARCHITECTURE_ID` and `BENCHMARK_URL`, then run:

```bash
npm run benchmark:architecture
```

The benchmark records p50, p95, and p99 latency, sustainable throughput, error rate, concurrency, region, and observation time. Authorization values are not written to benchmark output.

## Container And Azure App Service

The included multi-stage `Dockerfile` builds and runs the application with Node.js 22 on port `8080`:

```bash
docker build -t ai-architecture-decision-engine .
docker run --rm -p 8080:8080 --env-file .env ai-architecture-decision-engine
```

For Azure App Service:

1. Deploy to a Linux App Service or custom container runtime.
2. Set the Azure endpoint, deployment, and API version as App Service application settings.
3. Enable the system-assigned managed identity.
4. Grant that identity `Cognitive Services OpenAI User` on the Azure AI resource.
5. Use `npm start` as the startup command for a source/ZIP deployment.

Prefer managed identity and role-based access control over stored API keys. Use HTTPS, keep model calls server-side, and avoid logging prompts, bearer tokens, or sensitive assessment content.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `src/` | React workspace and deterministic decision, scoring, cost, and evaluation engines |
| `server/api/` | Recommendation and explanation services |
| `server/catalog/` | Versioned decision catalog |
| `server/evidence/` | Provider collectors, normalization, validation, and Azure AI Search integration |
| `scripts/` | Evidence refresh and architecture benchmark entry points |
| `docs/` | Detailed architecture, scoring, evidence, search, connector, and cost documentation |
| `public/` | Static application assets |

## Design Principles

- AI extracts and explains; deterministic code decides.
- Mandatory capability and non-functional gates run before ranking.
- Recommendations must remain reproducible from inputs and evidence.
- Missing required prices produce an unavailable cost, not a false zero.
- Evidence records include source, date, confidence, provider, metric, and scope.
- Assessment history is browser-local; durable multi-user persistence is not implemented.

## Further Documentation

- `docs/architecture-decision-system.md` - complete solution architecture
- `docs/scoring-methodology.md` - gates, scoring, and ranking behavior
- `docs/evidence-architecture.md` - evidence lifecycle and validation
- `docs/cost-calculation.md` - infrastructure and model cost calculations
- `docs/azure-ai-search.md` - optional search integration
- `docs/provider-connectors.md` - provider evidence collectors
- `docs/page-by-page-implementation.md` - user experience and implementation map
