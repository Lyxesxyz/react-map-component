// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

import type { MapError, MapErrorCode } from '../types'

export class MapConfigurationError extends Error {
  readonly mapError: MapError

  constructor(message: string, layerId?: string) {
    super(message)
    this.name = 'MapConfigurationError'
    this.mapError = {
      code: 'CONFIG_INVALID',
      message,
      recoverable: false,
      ...(layerId ? { layerId } : {}),
    }
  }
}

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
