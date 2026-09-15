# AI Architecture Decision Engine - Whole Solution Architecture

## 1. Architecture Summary

The AI Architecture Decision Engine is an evidence-driven decision-support application for enterprise architects. It combines AI-assisted requirement extraction with a deterministic recommendation engine. Azure AI converts a business problem into structured requirement signals, but it does not choose an architecture, model, provider, or winner.

The recommendation engine evaluates a versioned catalog of architecture patterns, model capabilities, benchmark observations, service prices, security controls, and availability evidence. Mandatory requirements are evaluated as gates before candidates are ranked. A recommendation remains reproducible from the assessment, catalog snapshot, and optional validated evidence overlay.

The solution has three logical planes:

1. **Interactive decision plane** - React experience, Vite middleware APIs, deterministic decision engine, cost optimization, comparison, and ADR export.
2. **Evidence management plane** - out-of-band pricing collectors, official-document verification, benchmark execution, normalization, validation, and atomic catalog updates.
3. **Optional evidence index plane** - Azure AI Search ingestion and retrieval for fresh, scoped evidence overlays. Search improves evidence freshness but is not required for recommendation correctness.

### Current-State Principles

- AI extracts and explains; deterministic code decides.
- Hard capability and non-functional gates run before ranking.
- Architecture ranking is deterministic and has no user-adjustable scoring weights.
- Model ranking uses fixed catalog-defined weights after capability gates.
- Provider prices cannot fall back across cloud providers.
- Missing required price categories produce an unavailable cost, not a false zero.
- Evidence carries source, observation date, confidence, provider, metric, and scope.
- Browser history is local-only; durable multi-user persistence is not implemented.
- Azure credentials remain in the server process and are never returned to the browser.

## 2. System Scope And Actors

| Actor or system | Type | Responsibility |
| --- | --- | --- |
| Enterprise architect | User | Defines requirements, reviews alternatives, runs scenarios, selects a model, and exports the ADR |
| Application operator | User | Refreshes evidence, executes benchmarks, validates catalog updates, and operates the runtime |
| React browser client | System | Hosts assessment, recommendation, compare, optimization, decision, and history experiences |
| Vite middleware server | System | Serves the SPA and exposes catalog, analysis, recommendation, explanation, and evidence APIs |
| Azure AI model endpoint | External service | Extracts structured requirements and generates bounded explanations from deterministic results |
| Azure AI Search | Optional external service | Stores and retrieves normalized evidence records scoped to architecture, model, provider, and freshness |
| Provider pricing APIs | External services | Supply official Azure, AWS, and Google Cloud SKU prices |
| Official documentation sites | External sources | Supply configured SLA, security, and capability facts over HTTPS |
| Independent benchmark sources | External sources | Supply model performance observations such as time to first token and output-token speed |
| Benchmark target | External workload | Receives controlled load tests and returns measured latency, throughput, and errors |

## 3. System Context Diagram

Solid elements are implemented. Dashed elements are recommended production additions.

```mermaid
flowchart LR
    Architect[Enterprise Architect]
    Operator[Application Operator]

    subgraph Solution[AI Architecture Decision Engine]
        Browser[React Decision Workspace]
        Server[Vite and Node Middleware APIs]
        Engine[Deterministic Decision Engine]
        Catalog[(Versioned Decision Catalog)]
        Jobs[Evidence Refresh and Benchmark Jobs]
    end

    AzureAI[Azure AI Model Endpoint]
    Search[(Azure AI Search - Optional)]
    PriceAPIs[Azure, AWS and Google Pricing APIs]
    Docs[Official Documentation and Benchmark Sources]
    Target[Benchmark Target]

    Architect --> Browser
    Browser --> Server
    Server --> AzureAI
    Server --> Engine
    Catalog --> Engine
    Server <--> Search
    Operator --> Jobs
    Jobs --> PriceAPIs
    Jobs --> Docs
    Jobs --> Target
    Jobs --> Catalog
    Jobs --> Search

    Entra[Microsoft Entra ID]:::recommended
    Monitor[Azure Monitor and Application Insights]:::recommended
    Durable[(Assessment and Audit Store)]:::recommended
    Entra -. authenticates .-> Browser
    Entra -. managed identity .-> Server
    Server -. telemetry .-> Monitor
    Server -. decisions and approvals .-> Durable

    classDef recommended stroke-dasharray: 6 4,fill:#f7f7f7,stroke:#666;
```

## 4. Component Architecture

```mermaid
flowchart TB
    subgraph Client[Browser - React 18]
        Assessment[Assessment and AI Discovery]
        Architecture[Architecture Recommendation]
        Compare[Architecture Compare]
        CostUI[Cost Optimization Workspace]
        WhatIf[What-If Scenario]
        TokenUI[Token Optimizer]
        ModelUI[Model Cost and Selection]
        Decide[Final Decision and ADR Export]
        History[(Browser Local Storage)]
    end

    subgraph API[Vite and Node Middleware]
        CatalogAPI[GET /api/catalog/architectures]
        AnalyzeAPI[POST /api/analyze]
        RecommendationAPI[POST /api/recommendations]
        ExplanationAPI[POST /api/recommendations/explain]
        EvidenceAPI[GET /api/evidence/search]
        Auth[Server-Side Azure Token Acquisition]
    end

    subgraph Domain[Deterministic Domain]
        Profile[Workload Profile Builder]
        Signals[Structured Signal Derivation]
        Gates[Requirement and Capability Gates]
        Technology[Technology Resolver]
        Resources[Resource Estimator]
        Cost[Infrastructure and Model Cost Engine]
        Evaluation[Latency, Capacity, Security and Availability]
        Confidence[Evidence Confidence Engine]
        Ranking[Gate-First Candidate Ranking]
        ModelRank[Capability-Gated Model Ranking]
        TokenEngine[Token Optimization Engine]
    end

    subgraph Evidence[Catalog and Evidence]
        Catalog[(decision-catalog.json)]
        Hydration[Catalog Hydration and Derivation]
        Validation[Evidence Validation]
        ArchStore[Architecture Runtime Catalog]
        ModelStore[Model Runtime Catalog]
        TechStore[Technology Mapping Catalog]
        SearchStore[(Azure AI Search - Optional)]
    end

    subgraph External[External Services]
        AzureAI[Azure AI Requirement Extraction and Explanation]
        ProviderAPIs[Provider Pricing APIs]
        OfficialDocs[Official Documents]
        Benchmarks[Independent and Internal Benchmarks]
    end

    Assessment --> AnalyzeAPI
    AnalyzeAPI --> Auth --> AzureAI
    Assessment --> RecommendationAPI
    RecommendationAPI --> Profile --> Signals --> Gates
    RecommendationAPI --> SearchStore --> Validation --> Gates
    CatalogAPI --> Catalog --> Hydration
    Hydration --> Validation
    Hydration --> ArchStore --> Gates
    Hydration --> ModelStore --> ModelRank
    Hydration --> TechStore --> Technology
    Gates --> Technology --> Resources --> Cost --> Evaluation --> Confidence --> Ranking
    ModelRank --> Cost
    Ranking --> Architecture
    Ranking --> Compare
    Ranking --> WhatIf
    Ranking --> ModelUI
    ModelUI --> TokenEngine
    WhatIf --> TokenEngine
    TokenEngine --> TokenUI --> Decide
    Architecture --> ExplanationAPI --> AzureAI
    Decide --> History
    ProviderAPIs --> Catalog
    OfficialDocs --> Catalog
    Benchmarks --> Catalog
```

## 5. Component Inventory

| Layer | Component | Primary implementation | Responsibility |
| --- | --- | --- | --- |
| Experience | Application shell and dashboard | `src/App.tsx` | Navigation, assessment state, scenario state, model selection, token override, catalog startup, and browser history |
| Experience | Recommendation workspace | `src/ArchitectureDecision.tsx` | Shows requirement fit, options, topology, evidence, metrics, cost, risks, trade-offs, and trace |
| Experience | Unified cost optimization | `src/CostOptimization.tsx` | Hosts What-If, Token Optimizer, and Model Cost and Selection tabs |
| Experience | What-If simulator | `src/WhatIfSimulator.tsx` | Changes architecture-significant constraints and reruns the same decision engine |
| Experience | Token optimizer | `src/TokenOptimization.tsx` | Selects optimization opportunities and applies only valid scenarios |
| Experience | Model catalog and selection | `src/ModelSearch.tsx` | Compares compatible models and supports explicit model selection |
| Experience | Final decision | `src/FinalDecision.tsx` | Consolidates architecture, model, optimization, risk, and ADR export |
| Artifact | ADR PDF generator | `src/adrPdf.ts` | Produces a downloadable architecture decision record |
| API | Middleware endpoints | `vite.config.ts` | Implements catalog, analysis, recommendation, explanation, and evidence routes |
| API | Recommendation service | `server/api/recommendationService.ts` | Validates requests, hydrates the catalog, retrieves evidence overlays, and invokes deterministic evaluation |
| API | Explanation service | `server/api/explanationService.ts` | Constrains AI explanations to facts supplied by the decision result |
| Domain | Decision engine | `src/domain/decisionEngine.ts` | Builds profiles, applies gates, evaluates candidates, ranks results, and emits decision trace |
| Domain | Requirement gates | `src/scoring/gates.ts` | Evaluates mandatory capability and non-functional requirements |
| Domain | Technology resolver | `src/catalog/technologyCatalog.ts` | Maps logical architecture components to provider technologies |
| Domain | Resource estimator | `src/resource/resourceEstimator.ts` | Calculates architecture-specific billable quantities from workload and topology |
| Domain | Cost engine | `src/cost/costEngine.ts` | Calculates official-provider infrastructure cost and model token cost ranges |
| Domain | Token optimization | `src/cost/tokenOptimizationEngine.ts` | Applies token reductions sequentially and rejects invalid quality, latency, capability, or compliance outcomes |
| Domain | Performance | `src/performance/latencyModel.ts` | Composes architecture overhead, model time to first token, and decode duration |
| Domain | Scalability | `src/scalability/scalabilityEngine.ts` | Evaluates measured or estimated capacity against peak load |
| Domain | Security | `src/security/securityEngine.ts` | Resolves each required security control independently as met, not met, or unknown |
| Domain | Availability | `src/availability/availabilityEngine.ts` | Evaluates measured or estimated SLA against the requirement |
| Domain | Confidence | `src/confidence/confidenceEngine.ts` | Summarizes evidence quality, freshness, and unresolved uncertainty |
| Catalog | Catalog client | `src/catalog/catalogClient.ts` | Loads, validates, derives, and hydrates runtime catalogs |
| Catalog | Model catalog | `src/catalog/modelCatalog.ts` | Gates models and ranks compatible options with fixed catalog weights |
| Catalog | Decision catalog | `server/catalog/decision-catalog.json` | Stores architecture definitions, model facts, collection configuration, prices, and observations |
| Evidence | Search evidence store | `server/evidence/azureAiSearchEvidenceStore.ts` | Retrieves optional evidence through scoped Azure AI Search filters |
| Evidence | Search evidence sink | `server/evidence/azureSearchEvidenceSink.ts` | Uploads normalized evidence using `DefaultAzureCredential` |
| Evidence | Evidence validation | `src/evidence/validation.ts` | Rejects malformed or out-of-contract evidence and reports freshness warnings |
| Operations | Evidence refresh | `scripts/refreshEvidence.ts` | Collects configured provider prices and document facts, then updates the catalog atomically |
| Operations | Provider collectors | `server/evidence/*PricingCollector.ts` | Call Azure, AWS, and Google pricing services without cross-provider substitution |
| Operations | Benchmark runner | `scripts/runArchitectureBenchmark.ts` | Executes controlled workload benchmarks and writes measured observations atomically |

## 6. Runtime Recommendation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Enterprise Architect
    participant UI as React SPA
    participant API as Vite Middleware
    participant AI as Azure AI
    participant Catalog as Catalog Hydration
    participant Search as Azure AI Search
    participant Engine as Decision Engine

    UI->>API: GET /api/catalog/architectures
    API->>Catalog: Read versioned JSON catalog
    Catalog-->>UI: Raw facts plus derived runtime records
    User->>UI: Enter business problem and constraints
    UI->>API: POST /api/analyze
    API->>API: Validate size and request shape
    API->>AI: Structured requirement extraction
    AI-->>API: Capabilities, workloads, signals, assumptions
    API->>API: Normalize and validate strict JSON shape
    API-->>UI: Advisory structured analysis
    User->>UI: Generate Architecture
    UI->>API: POST /api/recommendations
    API->>Catalog: Ensure current catalog hydration
    opt Search is configured
        API->>Search: Query by architecture, provider, and freshness
        Search-->>API: Scoped evidence records
        API->>API: Validate and reject out-of-scope records
    end
    API->>Engine: Assessment plus validated evidence
    Engine->>Engine: Build workload profile and derive signals
    Engine->>Engine: Apply hard gates to all candidates
    Engine->>Engine: Resolve services, resources, cost, and model
    Engine->>Engine: Evaluate latency, capacity, security, and SLA
    Engine->>Engine: Rank by eligibility and deterministic tie-breakers
    Engine-->>API: Recommendation, alternatives, trace, risks, confidence
    API-->>UI: Deterministic decision result
    opt User requests prose explanation
        UI->>API: POST /api/recommendations/explain
        API->>AI: Explain supplied facts only
        AI-->>UI: Bounded narrative explanation
    end
```

## 7. Deterministic Decision Pipeline

```mermaid
flowchart LR
    Input[Explicit Assessment plus Structured AI Signals]
    Profile[Normalized Workload Profile]
    Candidates[Seven Catalog Architecture Patterns]
    Gate{Mandatory Gates}
    Rejected[Not Eligible with Reasons]
    Partial[Partially Eligible with Unknown Evidence]
    Eligible[Eligible]
    ModelGate[Model Capability and Hosting Gates]
    Resources[Topology-Aware Resource Quantities]
    Price{All Required Provider Prices Available?}
    Unavailable[Cost Unavailable with Missing Categories]
    Cost[Low, Expected and High Monthly Cost]
    NFR[Latency, Capacity, Security and Availability Evaluation]
    Confidence[Evidence Confidence and Freshness]
    Rank[Deterministic Candidate Ordering]
    Result[Recommendation plus Auditable Trace]

    Input --> Profile
    Candidates --> Gate
    Profile --> Gate
    Gate -->|Failed| Rejected
    Gate -->|Unresolved| Partial
    Gate -->|Met or favorable estimate| Eligible
    Partial --> ModelGate
    Eligible --> ModelGate
    ModelGate --> Resources --> Price
    Price -->|No| Unavailable --> NFR
    Price -->|Yes| Cost --> NFR
    NFR --> Confidence --> Rank --> Result
    Rejected --> Rank
```

### Ranking Semantics

1. Fully eligible candidates precede partially eligible and not-eligible candidates.
2. Failed gates and unresolved gates remain visible in the trace.
3. Capability overreach, available monthly cost, implementation complexity, and stable identifiers provide deterministic ordering and tie-breaking.
4. Model selection first rejects incompatible models, then applies fixed catalog weights to compatible models.
5. Manual model selection is allowed only through the explicit `Use model` workflow; there are no adjustable model-priority sliders.

## 8. Cost And Optimization Flow

```mermaid
flowchart TB
    Workload[Requests, Peak Rate, Tokens and Requirements]
    Topology[Architecture Topology]
    Quantity[Billable Resource Quantities]
    Prices[(Provider-Specific Official Prices)]
    Infra[Infrastructure Cost Range]
    Compatible[Compatible Model Set]
    Model[Selected Model Price and Benchmark]
    LLMCost[Input, Cached Input and Output Token Cost]
    Baseline[Immutable Baseline]
    Opportunities[Optimization Opportunities]
    Simulate[Sequential Scenario Simulation]
    Validate{Capabilities, Quality, Latency, Security and Compliance Met?}
    Invalid[Rejected Scenario with Reasons]
    Ranked[Ranked Valid Scenarios]
    Applied[Applied Token Usage and Model]
    Final[Final Architecture Cost and ADR]

    Workload --> Quantity
    Topology --> Quantity
    Prices --> Infra
    Quantity --> Infra
    Workload --> Compatible --> Model --> LLMCost
    Infra --> Baseline
    LLMCost --> Baseline
    Baseline --> Opportunities --> Simulate --> Validate
    Validate -->|No| Invalid
    Validate -->|Yes| Ranked --> Applied --> Final
```

The infrastructure estimate multiplies architecture-specific quantities by exact provider and unit matches. Search is billed as provisioned search-unit-hours. Model latency composes architecture overhead, time to first token, and decode time. Planning ranges represent uncertainty instead of repeating one value three times.

## 9. Evidence Lifecycle

```mermaid
flowchart LR
    Operator[Operator or Scheduler]
    Refresh[refreshEvidence.ts]
    AzurePrice[Azure Retail Prices API]
    AWSPrice[AWS Price List API]
    GCPPrice[Google Billing Catalog API]
    Documents[Configured HTTPS Documents]
    Normalize[Normalize to Evidence Contract]
    Validate[Schema, Scope and Freshness Validation]
    Atomic[Atomic Catalog Update]
    Catalog[(Last-Known-Good Catalog)]
    Search[(Azure AI Search - Optional)]
    Bench[runArchitectureBenchmark.ts]
    Target[HTTPS or Local Benchmark Target]
    Metrics[p50, p95, p99, Throughput and Error Rate]
    Runtime[Recommendation Runtime]

    Operator --> Refresh
    Refresh --> AzurePrice
    Refresh --> AWSPrice
    Refresh --> GCPPrice
    Refresh --> Documents
    AzurePrice --> Normalize
    AWSPrice --> Normalize
    GCPPrice --> Normalize
    Documents --> Normalize
    Normalize --> Validate --> Atomic --> Catalog
    Validate --> Search
    Operator --> Bench --> Target --> Metrics --> Atomic
    Catalog --> Runtime
    Search --> Runtime
```

### Evidence Rules

- Refresh queries identify exact service, SKU, region, category, and billing unit.
- Failed collection retains the previous catalog fact and records the failure.
- Internet evidence must use HTTPS.
- Search overlays are validated and limited to the requested architecture, model, provider, dimension, and freshness window.
- Evidence strength is ordered from official API, SLA, or documentation through independent and internal benchmarks, expert rules, and assumptions.
- Recommendation execution remains synchronous against the last-known-good catalog snapshot.

## 10. Security And Trust Boundaries

```mermaid
flowchart LR
    subgraph BrowserBoundary[Untrusted Browser Boundary]
        SPA[React SPA]
        Local[(Local Storage History)]
    end
    subgraph ServerBoundary[Trusted Application Server Boundary]
        API[Vite Middleware APIs]
        Validation[Input and Evidence Validation]
        TokenCache[Short-Lived Entra Token Cache]
        Engine[Deterministic Engine]
        Catalog[(Catalog File)]
    end
    subgraph AzureBoundary[Azure Service Boundary]
        Entra[Microsoft Entra ID]
        AI[Azure AI Endpoint]
        Search[(Azure AI Search)]
    end

    SPA -->|JSON over HTTP in local development| API
    SPA --> Local
    API --> Validation --> Engine
    Catalog --> Engine
    API --> TokenCache
    TokenCache --> Entra
    API -->|Bearer token, server-side only| AI
    API -->|DefaultAzureCredential| Search

    WAF[HTTPS, WAF and Rate Limiting]:::recommended
    Private[Private Endpoints]:::recommended
    KeyVault[Key Vault or Managed Configuration]:::recommended
    Audit[(Durable Audit Store)]:::recommended
    WAF -. protects .-> API
    Private -. isolates .-> AI
    Private -. isolates .-> Search
    KeyVault -. configures .-> API
    Engine -. decision record .-> Audit
    classDef recommended stroke-dasharray: 6 4,fill:#f7f7f7,stroke:#666;
```

| Boundary | Implemented controls | Production gap or recommendation |
| --- | --- | --- |
| Browser to server | JSON validation, 256 KiB body limit, no Azure token returned to browser | Add Entra user authentication, authorization, CSRF posture, HTTPS, and rate limiting |
| Server to Azure AI | Server-side Entra token from Azure CLI, short-lived cache, strict response validation | Replace Azure CLI with managed identity and restrict endpoint networking |
| Server to Azure AI Search | `DefaultAzureCredential`, escaped allowlisted filters, schema validation | Separate Search Data Reader and Contributor identities; use private endpoint where required |
| Evidence ingestion | HTTPS source requirement, exact provider scope, atomic writes, last-known-good retention | Run as isolated scheduled job with alerting, approval gates, and immutable ingestion logs |
| Decision and approval | Deterministic trace and downloadable ADR | Add durable tenant-scoped assessment, approval, and audit persistence |
| Secrets and configuration | Environment variables and provider credential chains | Use managed app configuration and Key Vault references in production |

## 11. Deployment Views

### Implemented Local Topology

```mermaid
flowchart LR
    Browser[Desktop or Mobile Browser]
    Vite[Vite Development or Preview Process]
    Static[React Static Assets]
    Middleware[Node Middleware Plugins]
    Catalog[(Local JSON Catalog)]
    CLI[Azure CLI Identity]
    AI[Azure AI Endpoint]
    Search[(Azure AI Search - Optional)]

    Browser <--> Vite
    Vite --> Static
    Vite --> Middleware
    Middleware --> Catalog
    Middleware --> CLI --> AI
    Middleware --> Search
```

### Recommended Production Topology

This view is a target architecture, not infrastructure currently provisioned by this repository.

```mermaid
flowchart TB
    Users[Enterprise Architects]
    Entra[Microsoft Entra ID]
    Edge[Azure Front Door and WAF]
    subgraph AppZone[Application Zone]
        Web[Managed Web App or Container App]
        Identity[Managed Identity]
        Config[Managed Configuration and Key Vault References]
    end
    subgraph DataZone[Evidence and Governance Zone]
        Search[(Azure AI Search)]
        Audit[(Durable Assessment and Audit Store)]
        Storage[(Versioned Catalog and Job Artifacts)]
    end
    subgraph AIServiceZone[AI Service Zone]
        AI[Azure AI Model Endpoint]
    end
    subgraph OperationsZone[Operations Zone]
        Refresh[Scheduled Evidence Refresh Job]
        Benchmark[Controlled Benchmark Job]
        Monitor[Azure Monitor and Application Insights]
    end

    Users --> Entra --> Edge --> Web
    Web --> Identity
    Config --> Web
    Identity --> AI
    Identity --> Search
    Identity --> Audit
    Storage --> Web
    Refresh --> Storage
    Refresh --> Search
    Benchmark --> Storage
    Web --> Monitor
    Refresh --> Monitor
    Benchmark --> Monitor
```

The production host should be selected only after confirming traffic, networking, scaling, compliance, and operational constraints. The repository currently contains no deployment IaC, container definition, CI/CD workflow, or provisioned production topology.

## 12. Operational Architecture

| Concern | Current implementation | Production recommendation |
| --- | --- | --- |
| Build | `tsc -b && vite build` | Reproducible CI build with dependency and artifact scanning |
| Test | Vitest unit and service tests | Add browser journeys, accessibility tests, and deployment smoke tests |
| Catalog refresh | Manual `npm run catalog:refresh` | Scheduled isolated job with approval and freshness alerts |
| Benchmark | Manual `npm run benchmark:architecture` | Controlled environment, baseline comparison, and regression thresholds |
| Logging | Console messages and user-facing errors | Structured logs with correlation IDs and redaction |
| Metrics | Not exported | Request latency, AI failures, recommendation duration, evidence age, and unavailable-cost metrics |
| Tracing | Not implemented | Distributed traces across API, Search, Azure AI, and jobs |
| Health | Not implemented | Liveness, readiness, catalog version, and dependency health endpoints |
| Recovery | Last-known-good catalog survives collector failures | Versioned immutable catalog artifacts, rollback, backup, and recovery drills |
| Audit | Decision trace and PDF export | Durable assessment version, catalog hash, reviewer identity, approval, and ADR retention |

## 13. Relationships

1. The browser loads the catalog through the server and hydrates the same deterministic definitions used by the recommendation service.
2. Azure AI converts unstructured business text into a bounded structured analysis. Explicit user constraints remain authoritative.
3. The recommendation API optionally retrieves fresh evidence from Azure AI Search and rejects invalid or out-of-scope overlays.
4. The decision engine derives a normalized workload profile and evaluates every catalog architecture against mandatory requirements.
5. Candidate status is determined by failed, unresolved, or satisfied gates before ordering is considered.
6. The technology resolver maps logical components to services on the selected provider.
7. The resource estimator converts workload and topology into billable units.
8. The cost engine accepts only matching official provider prices and adds compatible-model token cost.
9. Performance, capacity, security, availability, and confidence engines preserve measured values, estimates, missing evidence, and provenance.
10. What-If reruns the same decision path with changed requirements; it does not mutate the baseline assessment.
11. Token optimization applies opportunities sequentially and excludes scenarios that violate mandatory requirements.
12. Explicit model selection recalculates model cost, latency evidence, technologies, and final decision output.
13. The Decide view generates the ADR from the final architecture, selected model, and applied token scenario.
14. Refresh and benchmark jobs update evidence out of band so an interactive request never depends directly on provider pricing APIs.

## 14. Visio Mapping Table

| Shape | Label | Layer | Connected To | Microsoft Icon |
| --- | --- | --- | --- | --- |
| Person | Enterprise Architect | Users | React Decision Workspace | User |
| Person | Application Operator | Users | Refresh Job, Benchmark Job | Administrator |
| Web application | React Decision Workspace | Channels | Middleware APIs, Local Storage | Azure App Service |
| Database | Browser Assessment History | Client Data | React Decision Workspace | Data |
| API | Catalog API | APIs | React SPA, Decision Catalog | API Management |
| API | Analyze API | APIs | React SPA, Azure AI | API Management |
| API | Recommendation API | APIs | React SPA, Search, Decision Engine | API Management |
| API | Explanation API | APIs | React SPA, Azure AI | API Management |
| API | Evidence Search API | APIs | React SPA, Azure AI Search | API Management |
| AI service | Requirement Extraction | AI Services | Analyze API | Azure OpenAI |
| AI service | Recommendation Explanation | AI Services | Explanation API | Azure OpenAI |
| Process | Workload Profile Builder | Decision Engine | Gates | Azure Functions |
| Decision | Mandatory Requirement Gates | Decision Engine | Rejected, Partial, Eligible | Azure Policy |
| Process | Technology Resolver | Decision Engine | Resource Estimator | Azure Functions |
| Process | Model Capability Gate and Ranking | Decision Engine | Cost Engine | Azure Machine Learning |
| Process | Resource Estimator | Decision Engine | Cost Engine | Azure Functions |
| Process | Cost Engine | Decision Engine | NFR Evaluators | Cost Management |
| Process | NFR Evaluators | Decision Engine | Confidence, Ranking | Azure Monitor |
| Process | Deterministic Ranking | Decision Engine | Recommendation Workspace | Azure Functions |
| Process | Token Optimization Engine | Optimization | Final Decision | Azure Functions |
| Document database | Decision Catalog | Evidence | Hydration, Refresh, Benchmark | Azure Storage |
| Process | Catalog Hydration | Evidence | Runtime Catalogs | Azure Functions |
| Search index | Evidence Index | Evidence | Recommendation API, Refresh Job | Azure AI Search |
| Batch process | Evidence Refresh Job | Operations | Pricing APIs, Documents, Catalog, Search | Container Apps Jobs |
| Batch process | Architecture Benchmark Job | Operations | Benchmark Target, Catalog | Azure Load Testing |
| External service | Provider Pricing APIs | External | Evidence Refresh Job | External Service |
| External service | Official and Benchmark Sources | External | Evidence Refresh Job | Internet |
| Document | Architecture Decision Record | Governance | Final Decision, Reviewer | Azure Files |
| Identity | Microsoft Entra ID | Security | User, Managed Identity | Microsoft Entra ID |
| Key | Managed Identity | Security | Azure AI, Search, Audit Store | Managed Identities |
| Shield | Front Door and WAF | Security | Users, Web App | Azure Front Door |
| Key vault | Managed Configuration | Security | Web App, Jobs | Azure Key Vault |
| Monitor | Central Observability | Operations | Web App, Jobs, Azure Services | Azure Monitor |
| Database | Durable Assessment and Audit Store | Governance | Web App, ADR, Reviewer | Azure Cosmos DB or Azure SQL |

## 15. Draw.io Import And Layout Mapping

Every Mermaid block can be imported directly into Draw.io using **Arrange > Insert > Advanced > Mermaid**. For a manually arranged enterprise diagram, use these swimlanes from left to right:

| Swimlane | Suggested X range | Contents |
| --- | ---: | --- |
| Actors | 0-180 | Enterprise Architect, Application Operator |
| Browser Experience | 220-500 | Assessment, Architecture, Compare, Cost Optimization, Decide |
| API Boundary | 540-760 | Catalog, Analyze, Recommendation, Explanation, Evidence APIs |
| Decision Domain | 800-1120 | Profile, Gates, Technology, Resources, Cost, NFR, Confidence, Ranking |
| Evidence Data | 1160-1380 | Decision Catalog, Runtime Catalogs, Azure AI Search, Audit Store |
| External Services | 1420-1660 | Azure AI, provider pricing, documents, benchmark target |
| Operations | 800-1380 below main flow | Refresh, benchmark, monitoring, catalog publication |

Use solid connectors for synchronous runtime calls, dotted connectors for optional integrations, and dashed borders for recommended production components. Use red connectors only for failed-gate paths, amber for unresolved evidence, green for eligible paths, and blue for normal data flow.

## 16. Assumptions, Gaps, And Decisions Still Required

- The checked-in catalog is a decision input, not a system of record for approvals.
- Azure AI Search is optional and must not become a hidden recommendation dependency.
- Checked-in benchmarks are seed baselines; production decisions require representative regional load tests.
- Provider SKU queries must be explicitly configured. The engine intentionally does not guess deployment SKUs.
- No production hosting service, Azure subscription topology, region, network, or disaster-recovery design is selected in this repository.
- No application user identity, tenant isolation, role model, or durable approval workflow is implemented.
- No deployment IaC, CI/CD pipeline, scheduled job infrastructure, private endpoints, or monitoring resources are implemented.
- Production design must define data classification, residency, retention, RTO, RPO, service-level objectives, and evidence-refresh objectives.
- The default local server uses Azure CLI authentication; production must use managed identity or workload identity.
- A catalog version or content hash should be retained with every durable recommendation and ADR to guarantee later reproducibility.