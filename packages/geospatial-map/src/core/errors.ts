// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { MapError, MapErrorCode } from '../types'

/** A `MapError` as a plain object (for statuses, `onError` and the error alert). */
export function mapError(
  code: MapErrorCode,
  message: string,
  recoverable: boolean,
  layerId?: string,
  cause?: unknown,
): MapError {
  return {
    code,
    message,
    recoverable,
    ...(layerId ? { layerId } : {}),
    ...(cause === undefined ? {} : { cause }),
  }
}

/** What the engine throws: a real `Error` (with a stack) carrying the structured `MapError`. */
export class MapErrorException extends Error {
  readonly mapError: MapError

  constructor(error: MapError) {
    super(error.message, error.cause === undefined ? undefined : { cause: error.cause })
    this.name = 'MapErrorException'
    this.mapError = error
  }
}

/** An invalid configuration, found while building the map. */
export class MapConfigurationError extends MapErrorException {
  constructor(message: string, layerId?: string) {
    super(mapError('CONFIG_INVALID', message, false, layerId))
    this.name = 'MapConfigurationError'
  }
}

/** The `MapError` for anything caught: the one a `MapErrorException` carries, or `fallback`. */
export function asMapError(cause: unknown, fallback: MapErrorCode): MapError {
  if (cause instanceof MapErrorException) return cause.mapError
  const message = cause instanceof Error ? cause.message : String(cause)
  return mapError(fallback, message, fallback !== 'CONFIG_INVALID', undefined, cause)
}
