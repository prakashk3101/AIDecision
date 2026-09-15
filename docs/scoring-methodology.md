# Scoring Methodology

## Pipeline

1. Typed workload requirements are produced from user input. GPT-5.4 mini may extract requirements but cannot select products or winners.
2. Mandatory capability gates remove incompatible candidates.
3. Applicable official, documented, or measured evidence is normalized into ten dimensions. Missing evidence remains unavailable.
4. Configured weights produce each candidate's weighted score.
5. Pareto analysis identifies non-dominated eligible alternatives.
6. Category recommendations select lowest cost, best performance, security, scalability, and complexity outcomes.

All coefficients and defaults are stored under `scoring` in `server/catalog/decision-catalog.json`.

## Cost

`src/cost/costEngine.ts` multiplies estimated resource quantities by matching official provider unit-price evidence. It does not use platform multipliers or fixed architecture costs. If any required resource category lacks a matching official price, the complete architecture cost remains unavailable rather than substituting a value. See `docs/cost-calculation.md`.

Budget is a shared engine gate through `WorkloadInput.monthlyBudget`, including What-If runs.

## Confidence

`src/confidence/confidenceEngine.ts` combines:

- source reliability by evidence type
- freshness
- measurement confidence
- applicability after assumption penalties
- requirement completeness
- ranking stability

Confidence describes decision support quality. It does not alter scores or ranking.

## Auditability

Every candidate exposes normalized scores, weighted contributions, gate failures, evidence, costs, assumptions, risks, and trade-offs. The recommendation screen exposes the raw evidence table. AI-generated prose cannot modify numeric outputs.
