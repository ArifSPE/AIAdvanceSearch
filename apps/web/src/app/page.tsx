import type { HealthResponse } from '@ais/shared'
import Link from 'next/link'
import { Card, CardTitle } from '@/components/ui/card'
import { client } from '@/lib/orpc'

/** Server component: proves the web app can reach the API at request time. */
async function getHealth(): Promise<HealthResponse | { error: string }> {
  try {
    return await client.health.check()
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'unreachable' }
  }
}

export default async function HomePage() {
  const health = await getHealth()
  const reachable = !('error' in health)

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">AI Advance Search</h1>
        <p className="text-ink-muted">
          Next.js App Router frontend, Fastify + Drizzle API, Postgres with full-text and pgvector
          search.
        </p>
      </section>

      <Card className="space-y-3">
        <CardTitle>API status</CardTitle>
        {reachable ? (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-muted">Service</dt>
            <dd className="tabular-nums">{health.status}</dd>
            <dt className="text-ink-muted">Database</dt>
            <dd className="tabular-nums">{health.database}</dd>
            <dt className="text-ink-muted">Uptime</dt>
            <dd className="tabular-nums">{health.uptime}s</dd>
          </dl>
        ) : (
          <div className="space-y-2 text-sm">
            <p>API unreachable — {health.error}</p>
            <p className="text-ink-muted">
              Start it with <code className="rounded bg-surface px-1">pnpm dev:api</code>.
            </p>
          </div>
        )}
      </Card>

      <Link
        href="/search"
        className="inline-block rounded-xl border border-line px-4 py-2 text-sm hover:border-accent"
      >
        Go to search →
      </Link>
    </div>
  )
}
