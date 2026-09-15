import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runBenchmark } from '../server/evidence/benchmarkRunner.js'

const architectureId = process.env.BENCHMARK_ARCHITECTURE_ID
const url = process.env.BENCHMARK_URL
if (!architectureId || !url) throw new Error('BENCHMARK_ARCHITECTURE_ID and BENCHMARK_URL are required')

const catalogPath = resolve('server/catalog/decision-catalog.json')
const temporaryPath = `${catalogPath}.tmp`
const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as {
  catalogVersion: string
  lastUpdated: string
  architectures: Array<{ id: string; observations: { benchmark: unknown } }>
}
const architecture = catalog.architectures.find(item => item.id === architectureId)
if (!architecture) throw new Error(`Unknown architecture: ${architectureId}`)

const authorization = process.env.BENCHMARK_AUTHORIZATION
const observation = await runBenchmark({
  url,
  requests: Number(process.env.BENCHMARK_REQUESTS ?? 1000),
  concurrency: Number(process.env.BENCHMARK_CONCURRENCY ?? 20),
  region: process.env.BENCHMARK_REGION ?? 'local',
  method: process.env.BENCHMARK_METHOD === 'POST' ? 'POST' : 'GET',
  body: process.env.BENCHMARK_BODY ? JSON.parse(process.env.BENCHMARK_BODY) : undefined,
  headers: authorization ? { Authorization: authorization } : undefined,
})

architecture.observations.benchmark = observation
catalog.lastUpdated = observation.measuredAt
catalog.catalogVersion = `${catalog.catalogVersion.split('+')[0]}+benchmark.${Date.now()}`
await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`)
await rename(temporaryPath, catalogPath)
console.log(JSON.stringify({ architectureId, ...observation, sourceUrl: new URL(observation.sourceUrl).origin }, null, 2))