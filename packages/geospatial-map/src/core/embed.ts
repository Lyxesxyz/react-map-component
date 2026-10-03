import type { EmbedSnippetOptions, MapState, PublicEmbedConfig } from '../types'

/** Creates a cloneable public embed payload that references a server-approved configuration. */
export function createPublicEmbedConfig(configId: string, state: MapState): PublicEmbedConfig {
  assertConfigId(configId)
  return { version: 1, configId, state: structuredClone(state) }
}

/** Creates an iframe snippet only when its destination origin is explicitly approved. */
export function createEmbedSnippet(options: EmbedSnippetOptions): string {
  assertConfigId(options.configId)
  const base = new URL(options.embedBaseUrl)
  if (
    !['https:', 'http:'].includes(base.protocol) ||
    !options.approvedOrigins.includes(base.origin)
  )
    throw new Error(`Embed origin ${base.origin} is not approved`)
  base.searchParams.set('config', options.configId)
  const width = dimension(options.width ?? '100%')
  const height = dimension(options.height ?? 640)
  const title = escapeAttribute(options.title ?? 'Interactive indicator map')
  return `<iframe src="${escapeAttribute(base.toString())}" title="${title}" width="${width}" height="${height}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin"></iframe>`
}

function assertConfigId(configId: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/.test(configId))
    throw new Error('Embed configuration ID must be 3–128 URL-safe characters')
}

function dimension(value: string | number): string {
  if (typeof value === 'number') return String(Math.max(1, Math.round(value)))
  if (!/^\d+(?:\.\d+)?(?:%|px|rem|vh|vw)?$/.test(value))
    throw new Error(`Unsafe embed dimension: ${value}`)
  return value
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
