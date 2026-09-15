import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { DefaultAzureCredential } from '@azure/identity'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { searchEvidence } from './server/evidence/azureAiSearchEvidenceStore.js'
import type { EvidenceSearchQuery } from './src/search/searchTypes.js'
import { createRecommendation, isRecommendationRequest } from './server/api/recommendationService.js'
import { explanationMessages, isExplanationRequest, isRecommendationExplanation } from './server/api/explanationService.js'

type ArchitectureAnalysis = {
  capabilities: string[]
  workloads: string[]
  assumptions: string[]
  businessGoal: string
  useCase: string
  complexity: number
  security: 'Standard' | 'High' | 'Critical'
  architectureTypes: Array<{ name: string; description: string; confidence: number }>
  signals: {
    predictiveScoring: boolean
    documentProcessing: boolean
    knowledgeRetrieval: boolean
    generativeResponse: boolean
    toolExecution: boolean
    workflowOrchestration: boolean
    humanReview: boolean
    eventStreaming: boolean
    realTime: boolean
  }
  potentialCompliance: string[]
}

function normalizeAnalysis(value: unknown, problem = ''): unknown {
  if (!value || typeof value !== 'object') return value
  const item = value as Record<string, unknown>
  const stringList = (input: unknown, max: number) => Array.isArray(input)
    ? input.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim()).slice(0, max)
    : typeof input === 'string' && input.trim() ? [input.trim()] : []
  const shortText = (input: unknown) => typeof input === 'string'
    ? input.trim()
    : stringList(input, 1)[0] ?? ''
  const score = (input: unknown) => {
    if (typeof input === 'number') return Math.round(input <= 1 ? input * 100 : input)
    if (typeof input === 'string') {
      const numeric = Number(input.replace('%', ''))
      if (Number.isFinite(numeric)) return Math.round(numeric <= 1 ? numeric * 100 : numeric)
      return ({ low: 30, medium: 60, high: 85, critical: 95 } as Record<string, number>)[input.toLowerCase()] ?? 70
    }
    return 70
  }
  const complexityScore = (input: unknown) => {
    const value = score(input)
    return value > 1 && value <= 5 ? value * 20 : value
  }
  const securityText = stringList(item.security, 8).join(' ').toLowerCase()
  const security: ArchitectureAnalysis['security'] = ['Critical', 'High', 'Standard'].includes(shortText(item.security))
    ? shortText(item.security) as ArchitectureAnalysis['security']
    : /hipaa|protected health|restricted|pci|mission.critical/.test(securityText) ? 'Critical' : securityText ? 'High' : 'Standard'
  const architectureTypes = Array.isArray(item.architectureTypes) ? item.architectureTypes.slice(0, 3).map(type => {
    const entry = type && typeof type === 'object' ? type as Record<string, unknown> : {}
    return { name: shortText(entry.name), description: shortText(entry.description), confidence: score(entry.confidence) }
  }) : []
  const signalInput = item.signals && typeof item.signals === 'object' ? item.signals as Record<string, unknown> : {}
  const signalNames = ['predictiveScoring', 'documentProcessing', 'knowledgeRetrieval', 'generativeResponse', 'toolExecution', 'workflowOrchestration', 'humanReview', 'eventStreaming', 'realTime'] as const
  const signals = Object.fromEntries(signalNames.map(name => [name, signalInput[name] === true])) as ArchitectureAnalysis['signals']
  const normalizedProblem = problem.toLowerCase()
  const fraudScoring = /fraud|anomal\w* transaction|transaction risk|financial crime|aml|anti-money laundering/.test(normalizedProblem)
  const explicitAgenticWork = /\bagents?\b|tool calls?|function calls?|external api|api invocation|multi-step|workflow orchestration/.test(normalizedProblem)
  const explicitGenerativeWork = /\bgenerative\b|chatbot|assistant|summari[sz]\w*|content generation|natural language response/.test(normalizedProblem)
  if (fraudScoring) {
    signals.predictiveScoring = true
    if (!explicitAgenticWork) {
      signals.toolExecution = false
      signals.workflowOrchestration = false
    }
    if (!explicitGenerativeWork) {
      signals.generativeResponse = false
      signals.knowledgeRetrieval = false
    }
  }

  return {
    capabilities: stringList(item.capabilities, 8),
    workloads: stringList(item.workloads, 6),
    assumptions: stringList(item.assumptions, 6),
    businessGoal: shortText(item.businessGoal),
    useCase: shortText(item.useCase),
    complexity: complexityScore(item.complexity),
    security,
    architectureTypes,
    signals,
    potentialCompliance: stringList(item.potentialCompliance, 6),
  }
}

function isArchitectureAnalysis(value: unknown): value is ArchitectureAnalysis {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ArchitectureAnalysis>
  const strings = (items: unknown, max: number) => Array.isArray(items) && items.length > 0 && items.length <= max && items.every(entry => typeof entry === 'string' && entry.length > 0)
  return strings(item.capabilities, 8)
    && strings(item.workloads, 6)
    && strings(item.assumptions, 6)
    && typeof item.businessGoal === 'string'
    && typeof item.useCase === 'string'
    && Number.isInteger(item.complexity) && item.complexity! >= 0 && item.complexity! <= 100
    && ['Standard', 'High', 'Critical'].includes(item.security ?? '')
    && Array.isArray(item.architectureTypes)
    && item.architectureTypes.length > 0
    && item.architectureTypes.length <= 3
    && item.architectureTypes.every(type => typeof type.name === 'string' && typeof type.description === 'string' && Number.isInteger(type.confidence) && type.confidence >= 0 && type.confidence <= 100)
    && item.signals !== undefined
    && Object.values(item.signals).every(signal => typeof signal === 'boolean')
    && Array.isArray(item.potentialCompliance)
}

async function readJsonBody(request: IncomingMessage) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 262_144) throw new Error('Request is too large.')
  }
  return JSON.parse(body) as unknown
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function architectureCatalogPlugin(): Plugin {
  const middleware = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.url !== '/api/catalog/architectures' || request.method !== 'GET') {
      next()
      return
    }
    try {
      const catalogPath = resolve(process.cwd(), 'server', 'catalog', 'decision-catalog.json')
      const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as unknown
      response.setHeader('Cache-Control', 'no-store')
      sendJson(response, 200, catalog)
    } catch (error) {
      console.error('Architecture catalog failed:', error instanceof Error ? error.message : error)
      sendJson(response, 500, { error: 'Decision catalog is unavailable.' })
    }
  }
  const attach = (server: { middlewares: { use: (handler: typeof middleware) => unknown } }) => {
    server.middlewares.use(middleware)
  }
  return { name: 'architecture-catalog-api', configureServer: attach, configurePreviewServer: attach }
}

function evidenceSearchPlugin(): Plugin {
  const middleware = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith('/api/evidence/search') || request.method !== 'GET') {
      next()
      return
    }
    try {
      const url = new URL(request.url, 'http://localhost')
      const query: EvidenceSearchQuery = {
        text: url.searchParams.get('text') ?? undefined,
        provider: url.searchParams.get('provider') ?? undefined,
        dimension: (url.searchParams.get('dimension') as EvidenceSearchQuery['dimension']) ?? undefined,
        architectureId: url.searchParams.get('architectureId') ?? undefined,
        modelId: url.searchParams.get('modelId') ?? undefined,
        sourceType: (url.searchParams.get('sourceType') as EvidenceSearchQuery['sourceType']) ?? undefined,
        freshAfter: url.searchParams.get('freshAfter') ?? undefined,
        limit: Number(url.searchParams.get('limit') ?? 25),
      }
      sendJson(response, 200, await searchEvidence(query))
    } catch (error) {
      console.error('Evidence search failed:', error instanceof Error ? error.message : error)
      sendJson(response, 500, { error: 'Evidence search is unavailable.' })
    }
  }
  const attach = (server: { middlewares: { use: (handler: typeof middleware) => unknown } }) => {
    server.middlewares.use(middleware)
  }
  return { name: 'evidence-search-api', configureServer: attach, configurePreviewServer: attach }
}

function recommendationPlugin(): Plugin {
  const middleware = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.url !== '/api/recommendations' || request.method !== 'POST') {
      next()
      return
    }
    try {
      const body = await readJsonBody(request)
      if (!isRecommendationRequest(body)) {
        sendJson(response, 400, { error: 'A valid assessment with a detailed problem statement is required.' })
        return
      }
      response.setHeader('Cache-Control', 'no-store')
      sendJson(response, 200, await createRecommendation(body))
    } catch (error) {
      console.error('Recommendation failed:', error instanceof Error ? error.message : error)
      sendJson(response, 500, { error: 'Recommendation could not be calculated.' })
    }
  }
  const attach = (server: { middlewares: { use: (handler: typeof middleware) => unknown } }) => {
    server.middlewares.use(middleware)
  }
  return { name: 'recommendation-api', configureServer: attach, configurePreviewServer: attach }
}

function azureAnalysisPlugin(endpoint: string, deployment: string, apiVersion: string): Plugin {
  const credential = new DefaultAzureCredential()
  let cachedToken: { value: string; expiresAt: number } | null = null
  let tokenRequest: Promise<string> | null = null

  const getAccessToken = async () => {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
    if (tokenRequest) return tokenRequest
    tokenRequest = (async () => {
      const token = await credential.getToken('https://cognitiveservices.azure.com/.default')
      if (!token) throw new Error('Azure credential did not return an access token.')
      cachedToken = { value: token.token, expiresAt: token.expiresOnTimestamp }
      return token.token
    })()
    try {
      return await tokenRequest
    } finally {
      tokenRequest = null
    }
  }

  const middleware = async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const isAnalysis = request.url === '/api/analyze' && request.method === 'POST'
    const isExplanation = request.url === '/api/recommendations/explain' && request.method === 'POST'
    if (!isAnalysis && !isExplanation) {
      next()
      return
    }

    try {
      const body = await readJsonBody(request)
      if (isExplanation) {
        if (!isExplanationRequest(body)) {
          sendJson(response, 400, { error: 'A complete deterministic recommendation is required.' })
          return
        }
        const accessToken = await getAccessToken()
        const azureResponse = await fetch(`${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: explanationMessages(body.recommendation), response_format: { type: 'json_object' }, max_completion_tokens: 900 }),
        })
        if (!azureResponse.ok) throw new Error(`Azure AI returned ${azureResponse.status}.`)
        const completion = await azureResponse.json() as { model?: string; choices?: Array<{ message?: { content?: string } }> }
        const content = completion.choices?.[0]?.message?.content
        const explanation = content ? JSON.parse(content) : null
        if (!isRecommendationExplanation(explanation)) throw new Error('Azure AI returned an invalid explanation shape.')
        response.setHeader('Cache-Control', 'no-store')
        sendJson(response, 200, { explanation, model: completion.model ?? deployment, explainedAt: new Date().toISOString() })
        return
      }

      const analysisBody = body as { problem?: unknown }
      if (typeof analysisBody.problem !== 'string' || analysisBody.problem.trim().length < 20 || analysisBody.problem.length > 8000) {
        sendJson(response, 400, { error: 'Enter at least 20 characters describing the business problem.' })
        return
      }

      const accessToken = await getAccessToken()

      const azureResponse = await fetch(`${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an enterprise architecture requirements analyst. Extract architecture-significant requirements without selecting products or a winning architecture. Return only valid JSON with this exact shape: {"capabilities":["string"],"workloads":["string"],"assumptions":["string"],"businessGoal":"string","useCase":"string","complexity":0,"security":"Standard|High|Critical","architectureTypes":[{"name":"string","description":"string","confidence":0}],"signals":{"predictiveScoring":false,"documentProcessing":false,"knowledgeRetrieval":false,"generativeResponse":false,"toolExecution":false,"workflowOrchestration":false,"humanReview":false,"eventStreaming":false,"realTime":false},"potentialCompliance":["string"]}. Set signals from the functional behavior the request describes, not only from literal keywords. Fraud detection, transaction-risk scoring, anomaly detection, classification, and likelihood scoring are predictiveScoring, not agentic or generative AI; a request for an explanation of a model score alone does not imply generativeResponse, toolExecution, or workflowOrchestration. Set toolExecution true when the system must search, call, or integrate with external services, APIs, or third-party inventories (for example, searching and combining flights, hotels, or other provider data), even if the words "agent" or "tool call" are not used. Set workflowOrchestration true when the system must coordinate multiple steps, continuously refine, re-plan, or re-rank a result as inputs or availability change. Set generativeResponse true when the system must compose, assemble, or generate a personalized output such as a plan, itinerary, or written response, not only when the request says "generative" or "chatbot". Use concise labels. Maximums: 8 capabilities, 6 workloads, 6 assumptions, 3 architecture types, 6 potential compliance items. Potential compliance is advisory, not confirmed.',
            },
            { role: 'user', content: analysisBody.problem.trim() },
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: 900,
        }),
      })

      if (!azureResponse.ok) throw new Error(`Azure AI returned ${azureResponse.status}.`)
      const completion = await azureResponse.json() as { model?: string; choices?: Array<{ message?: { content?: string } }> }
      const content = completion.choices?.[0]?.message?.content
      const analysis = normalizeAnalysis(content ? JSON.parse(content) : null, analysisBody.problem)
      if (!isArchitectureAnalysis(analysis)) throw new Error('Azure AI returned an invalid analysis shape.')
      sendJson(response, 200, { ...analysis, model: completion.model ?? deployment, analyzedAt: new Date().toISOString() })
    } catch (error) {
      console.error('Azure analysis failed:', error instanceof Error ? error.message : error)
      sendJson(response, 502, { error: 'Live AI analysis is temporarily unavailable.' })
    }
  }

  const attach = (server: { middlewares: { use: (handler: typeof middleware) => unknown } }) => {
    server.middlewares.use(middleware)
  }
  return { name: 'azure-architecture-analysis', configureServer: attach, configurePreviewServer: attach }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const endpoint = env.AZURE_OPENAI_ENDPOINT ?? 'https://cog-x42asfknbrhss.cognitiveservices.azure.com/'
  const deployment = env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5.4-mini'
  const apiVersion = env.AZURE_OPENAI_API_VERSION ?? '2025-04-01-preview'
  return {
    plugins: [react(), architectureCatalogPlugin(), evidenceSearchPlugin(), recommendationPlugin(), azureAnalysisPlugin(endpoint, deployment, apiVersion)],
    server: { host: '127.0.0.1' },
    preview: {
      allowedHosts: ['aidecision-hfcefqfucseahxaa.westus3-01.azurewebsites.net'],
    },
  }
})
