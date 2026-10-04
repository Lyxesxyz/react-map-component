// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

// The one place the engine talks HTTP: clear errors for failed requests, web pages served
// instead of data, and errors ArcGIS reports inside successful responses.

/** The body of `url` as text. Throws `HTTP <status> from <url>` for a failed request. */
export async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<{ text: string; contentType: string }> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
  return { text: await response.text(), contentType: response.headers.get('content-type') ?? '' }
}

/** Parses JSON, explaining the usual reasons it isn't (a login page, a wrong URL). */
export function parseJson(text: string, url: string): unknown {
  if (/^\s*</.test(text))
    throw new Error(
      `${url} returned a web page instead of data. Check the URL; if the data needs a login, ` +
        'pass loadGeoJson to add credentials.',
    )
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`${url} did not return valid JSON. Check that the URL points at the data.`)
  }
}

/** Fetches and parses JSON, failing with ArcGIS's own message when the response carries one. */
export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const json = parseJson((await fetchText(url, init)).text, url)
  const failure = arcgisErrorOf(json, url)
  if (failure) throw failure
  return json
}

/** The error an ArcGIS service reported in a successful (HTTP 200) response, if any. */
function arcgisErrorOf(json: unknown, url: string): Error | undefined {
  const error = (json as { error?: { message?: string; details?: string[] } } | null)?.error
  if (!error || typeof error !== 'object') return undefined
  const details = error.details?.filter(Boolean).join(' ')
  return new Error(
    `ArcGIS returned an error for ${url}: ${error.message ?? 'unknown'}${details ? ` (${details})` : ''}`,
  )
}

/**
 * `load` run once per key for the life of the page, shared by every map. A failure is forgotten,
 * so the next call (for example the next mount) tries again.
 */
export function memoizeAsync<T>(load: (key: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>()
  return (key: string): Promise<T> => {
    let result = pending.get(key)
    if (!result) {
      result = load(key)
      result.catch(() => pending.delete(key))
      pending.set(key, result)
    }
    return result
  }
}

/** An ArcGIS Online item (page URL, REST URL, or bare id), if `input` refers to one. */
export function arcgisItem(input: string): { portal: string; id: string } | undefined {
  const value = input.trim()
  if (/^[0-9a-f]{32}$/i.test(value)) return { portal: 'https://www.arcgis.com', id: value }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  const fromQuery = url.searchParams.get('id')
  if (url.pathname.includes('/home/item.html') && fromQuery && /^[0-9a-f]{32}$/i.test(fromQuery))
    return { portal: url.origin, id: fromQuery }
  const fromPath = /\/sharing\/rest\/content\/items\/([0-9a-f]{32})/i.exec(url.pathname)?.[1]
  return fromPath ? { portal: url.origin, id: fromPath } : undefined
}
