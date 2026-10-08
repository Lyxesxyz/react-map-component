import type { LayerStatus, MapMessages } from './types'

// All user-facing copy lives here. Pass a partial `messages` object in the map config to
// localize; missing keys fall back to these English defaults.

/** Fully resolved English message catalog. */
export const defaultMapMessages: MapMessages = {
  mapLoading: 'Map loading',
  mapReady: 'Map ready',
  selectedFeature: 'Selected {feature}',
  selectionCleared: 'Selection cleared',
  timeChanged: 'Time changed to {time}',
  timeCleared: 'Time cleared',
  mapControls: 'Map controls',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetZoom: 'Reset zoom',
  findLocation: 'Find my location',
  locationUnavailable: 'Location is not available in this browser.',
  locationDenied: 'Your location could not be retrieved. Check browser permissions.',
  layers: 'Layers',
  fitSelection: 'Fit selection',
  fitData: 'Fit data',
  mapSettings: 'Map settings',
  disclaimer: 'Disclaimer',
  fullscreen: 'Toggle fullscreen',
  mapOptions: 'Map options',
  viewAndOutput: 'View & output',
  closeSettings: 'Close map settings',
  basemap: 'Basemap',
  goToArea: 'Go to area',
  zoomToArea: 'Zoom to area',
  chooseArea: 'Choose area',
  download: 'Download',
  exportMap: 'Export map',
  exportReportImage: 'Export report image',
  mapContent: 'Map content',
  mapLayers: 'Map layers',
  closeLayers: 'Close layer panel',
  layersVisible: '{visible} of {total} visible',
  layerOptions: 'Options for {layer}',
  showLayerOptions: 'Show options for {layer}',
  hideLayerOptions: 'Hide options for {layer}',
  otherLayers: 'Other layers',
  oneLayerAtATime: 'Show one layer at a time',
  opacity: 'Opacity {value}%',
  layerOpacity: '{layer} opacity',
  chooseOne: 'choose one',
  unavailableAtScale: 'unavailable at this scale',
  noDataForTime: 'No data for time',
  sourceError: 'source error',
  moveLayerUp: 'Move {layer} up',
  moveLayerDown: 'Move {layer} down',
  legend: 'Legend',
  units: 'Units: {units}',
  selectedFeatureDetails: 'Selected feature details',
  closeFeatureDetails: 'Close feature details',
  timeControls: 'Time controls',
  playTime: 'Play time animation',
  pauseTime: 'Pause time animation',
  replayTime: 'Replay time animation',
  previousTime: 'Previous time',
  nextTime: 'Next time',
  selectedTime: 'Selected time',
  playbackSpeed: 'Playback speed',
  time: 'Time {time}',
  loadingFrame: 'loading frame',
  frameUnavailable: 'frame unavailable; playback paused',
  loading: 'Loading',
  dismiss: 'Dismiss',
  attribution: 'Map attribution',
  invalidConfiguration: 'Map configuration is invalid',
  returnToGrid: 'Return to grid',
  focusMap: 'Focus {title}',
  geographicHierarchy: 'Geographic hierarchy',
  publishedOn: 'published {date}',
  nonOfficial: '(non-official)',
  tooManyGridMaps: 'MapGrid supports at most six maps.',
  exportTime: 'Time: {time}',
  exportSelectedArea: 'Selected area: {area}',
  exportScale: 'Scale: zoom {zoom} · {projection}',
}

/** Replaces `{name}` placeholders in a localized message template. */
export function formatMapMessage(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

/** Resolves partial localized messages against the English catalog. */
export function resolveMapMessages(messages: Partial<MapMessages> | undefined): MapMessages {
  return { ...defaultMapMessages, ...messages }
}

/** What is wrong with a layer, in a few words, or `undefined` when nothing is. */
export function layerStatusLabel(
  status: LayerStatus | undefined,
  messages: MapMessages,
): string | undefined {
  if (status?.error) return messages.sourceError
  if (status?.noData) return messages.noDataForTime
  if (status?.scaleUnavailable) return messages.unavailableAtScale
  return undefined
}
