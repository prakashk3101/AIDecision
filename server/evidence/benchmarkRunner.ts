export type BenchmarkConfiguration = {
  url: string
  requests: number
  concurrency: number
  region: string
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
}

export type BenchmarkObservation = {
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  sustainableRequestsPerSecond: number
  errorRatePercent: number
  testConfiguration: Omit<BenchmarkConfiguration, 'url' | 'body' | 'headers'>
  measuredAt: string
  sourceUrl: string
  sourceType: 'internal-benchmark'
}

const percentile = (sorted: number[], value: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0

export async function runBenchmark(configuration: BenchmarkConfiguration): Promise<BenchmarkObservation> {
  if (!configuration.url.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(configuration.url)) {
    throw new Error('Benchmark URL must use HTTPS unless it targets localhost')
  }
  const latencies: number[] = []
  let failures = 0
  let nextRequest = 0
  const startedAt = performance.now()
  const worker = async () => {
    while (nextRequest < configuration.requests) {
      nextRequest += 1
      const requestStarted = performance.now()
      try {
        const response = await fetch(configuration.url, {
          method: configuration.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...configuration.headers },
          body: configuration.body === undefined ? undefined : JSON.stringify(configuration.body), signal: AbortSignal.timeout(30_000),
        })
        if (!response.ok) failures += 1
        await response.arrayBuffer()
      } catch {
        failures += 1
      } finally {
        latencies.push(performance.now() - requestStarted)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(configuration.concurrency, configuration.requests) }, worker))
  const elapsedSeconds = Math.max(.001, (performance.now() - startedAt) / 1000)
  latencies.sort((left, right) => left - right)
  return {
    p50LatencyMs: Math.round(percentile(latencies, .5)), p95LatencyMs: Math.round(percentile(latencies, .95)),
    p99LatencyMs: Math.round(percentile(latencies, .99)), sustainableRequestsPerSecond: Math.round(configuration.requests / elapsedSeconds),
    errorRatePercent: Number((failures / configuration.requests * 100).toFixed(3)),
    testConfiguration: { requests: configuration.requests, concurrency: configuration.concurrency, region: configuration.region, method: configuration.method },
    measuredAt: new Date().toISOString(), sourceUrl: configuration.url, sourceType: 'internal-benchmark',
  }
}