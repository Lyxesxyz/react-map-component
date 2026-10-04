// Engine internals: read freely, but don't edit to customise the map. Change behaviour through
// the config, CSS tokens and classes, the map-*.tsx parts, or onOpenLayersMap (see AGENTS.md).
// Edits here are the most likely to conflict when the folder is updated.

/**
 * Whether the layer at `index` of `layers` (drawing order, bottom first) can move one step up
 * (`1`) or down (`-1`): it and the layer it trades places with must both be `reorderable`.
 * The layer panel and the map use the same rule.
 */
export function canReorder(
  layers: ReadonlyArray<{ reorderable?: boolean | undefined }>,
  index: number,
  direction: -1 | 1,
): boolean {
  const target = index + direction
  if (index < 0 || target < 0 || target >= layers.length) return false
  return layers[index]?.reorderable !== false && layers[target]?.reorderable !== false
}
