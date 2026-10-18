import type { SearchHit } from '@ais/shared'

export function SearchResults({ hits }: { hits: SearchHit[] }) {
  if (hits.length === 0) {
    return <p className="text-sm text-ink-muted">No matches.</p>
  }

  return (
    <ol className="space-y-4">
      {hits.map((hit) => (
        <li key={hit.id} className="rounded-xl border border-line p-4">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-medium">
              {hit.url ? (
                <a href={hit.url} className="text-accent hover:underline" rel="noreferrer noopener" target="_blank">
                  {hit.title}
                </a>
              ) : (
                hit.title
              )}
            </h3>
            <span className="shrink-0 text-xs text-ink-muted tabular-nums">
              {hit.score.toFixed(4)}
            </span>
          </div>
          {/*
            ts_headline returns <mark> tags from the API. The snippet is derived from
            content we store, so this is trusted markup — sanitise here if you ever
            index third-party HTML.
          */}
          <p
            className="mt-2 text-sm leading-relaxed text-ink-muted"
            dangerouslySetInnerHTML={{ __html: hit.snippet }}
          />
        </li>
      ))}
    </ol>
  )
}
