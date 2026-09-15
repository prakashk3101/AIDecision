# Architecture Decision Record

## Title
Insurance Claims Processing

## Context
We need an AI-powered insurance claims solution to process documents, detect fraud, and route complex claims for human approval.

## Business Requirements
- Scale: Enterprise (50K+ users)
- AI requirement: Let AI Determine
- P95 latency: 2000ms
- Availability: 99.95%
- Monthly requests: 250K - 500K
- Peak load: 3 requests/second
- Data sensitivity: High / Confidential
- Compliance: ISO 27001, PII
- Security controls: PII Protection, Data Loss Prevention, Customer-Managed Keys
- Source citations: Required
- Existing technology: AWS, Amazon EKS, Amazon RDS
- Integrations: SAP, Workday, Snowflake, ServiceNow

## AI-Detected Capabilities
- Document ingestion and classification
- OCR and data extraction
- Claims triage and workflow orchestration
- Fraud detection and anomaly scoring
- Human review and approval routing
- Audit logging and decision traceability
- Model monitoring and feedback loop
- Integration with claims and document systems

## AI-Detected Workloads
- Claims document processing
- Fraud analytics scoring
- Human-in-the-loop case review
- Workflow routing and exception handling
- Analytics and reporting

## Decision
Select **Workflow + AI** (Structured intelligent automation) with a deterministic weighted score of 88/100 and 85% decision confidence.

## Selected Platform
AWS

## Selected Architecture and Technologies
- API Gateway: Amazon API Gateway
- Workflow Engine: AWS Step Functions
- Document Processing: Amazon Textract
- AI Model: Amazon Bedrock
- Human Review: Amazon A2I
- Operational DB: Amazon Aurora
- Object Storage: Amazon S3

## Alternatives Considered
- Hybrid ML + Rules: 87/100
- Event-Driven ML: 82/100
- Traditional Service Architecture: 82/100
- Retrieval-Augmented Generation: Rejected — Availability 99.9% is below 99.95%
- Agentic Orchestration: Rejected — P95 latency 2400ms exceeds 2000ms SLA; Availability 99.9% is below 99.95%

## Scoring Summary
- Architecture Fit: 94/100 × 25.0% = 23.5
- Cost Efficiency: 70/100 × 15.0% = 10.5
- Performance: 94/100 × 15.0% = 14.1
- Security: 93/100 × 15.0% = 13.95
- Scalability: 100/100 × 15.0% = 15
- Availability: 90/100 × 5.0% = 4.5
- Complexity: 63/100 × 10.0% = 6.3

## Cost
Low $5,713, expected $7,141, high $9,283 per month.

## Risks and Mitigations
- Low: Workflow state requires governance. Validate during a focused proof of concept and architecture review.
- Low: Moderate AI inference cost. Validate during a focused proof of concept and architecture review.

## Trade-offs
- Workflow + AI costs $3,238 more per month than Traditional Service Architecture.
- Event-Driven ML is 582ms faster at P95.
- Workflow state requires governance
- Moderate AI inference cost

## Assumptions
- Structured and unstructured claim documents will be submitted digitally
- Existing claims systems or case management tools need integration
- Fraud indicators and routing rules can be learned from historical claims data
- Human adjusters will review low-confidence or high-risk cases
- Regulatory retention and audit requirements apply to claim decisions
- Data residency may influence deployment options

## Consequences
The selected architecture passed all mandatory gates. Scores must be recalculated when requirements, evidence, pricing, or weights change.

## Approval
Status: AI_DRAFT — pending architect review

## Date
2026-08-27
