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
