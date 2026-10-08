// Compile-time only (checked by `pnpm typecheck`): each JSON Schema in `config/schema.ts` and the
// hand-written type documenting it accept the same values. A field added to one and not the
// other turns a `true` below into a type error.
import type { Static } from 'typebox'
import type {
  accessibilitySchema,
  basemapSchema,
  configInputSchema,
  dataSchema,
  exportOptionsSchema,
  exportSchema,
  featureDataSchema,
  layerSchema,
  legendSchema,
  stateSchema,
  symbolSchema,
  themeSchema,
  thematicStyleSchema,
  uiSchema,
  viewSchema,
} from '../src/config/schema'
import type {
  AccessibilityConfig,
  BasemapConfig,
  DataConfig,
  ExportConfig,
  ExportOptions,
  MapConfigInput,
  GeoJsonData,
  LegendSpec,
  MapLayerConfig,
  MapState,
  MapTheme,
  MapUiConfig,
  SymbolSpec,
  ThematicStyleSpec,
  ViewConfig,
} from '../src/types'

type Mutable<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
      : T

type Schemas = {
  symbol: Static<typeof symbolSchema>
  style: Static<typeof thematicStyleSchema>
  legend: Static<typeof legendSchema>
  data: Static<typeof featureDataSchema>
  layer: Static<typeof layerSchema>
  basemap: Static<typeof basemapSchema>
  dataConfig: Static<typeof dataSchema>
  state: Static<typeof stateSchema>
  view: Static<typeof viewSchema>
  ui: Static<typeof uiSchema>
  exportOptions: Static<typeof exportOptionsSchema>
  exportConfig: Static<typeof exportSchema>
  theme: Static<typeof themeSchema>
  accessibility: Static<typeof accessibilitySchema>
  // `messages` is built from the message keys at runtime, so its schema is a plain record.
  input: Omit<Static<typeof configInputSchema>, 'messages'>
}

type Types = {
  symbol: SymbolSpec
  style: ThematicStyleSpec
  legend: LegendSpec
  data: GeoJsonData
  layer: MapLayerConfig
  basemap: BasemapConfig
  dataConfig: DataConfig
  state: MapState
  view: ViewConfig
  ui: MapUiConfig
  exportOptions: ExportOptions
  exportConfig: ExportConfig
  theme: MapTheme
  accessibility: AccessibilityConfig
  input: Omit<MapConfigInput, 'messages'>
}

// Each schema's values are values of its type, and the other way round.
declare const schemaValues: Mutable<Schemas>
declare const typeValues: Mutable<Types>
export const schemaToType: Mutable<Types> = schemaValues
export const typeToSchema: Mutable<Schemas> = typeValues

// Assignability ignores an optional field present on one side only, so the field paths are
// compared too (`.ui.time.loop`, `.layers[].style.symbol.radius`, …).
type Primitive = string | number | boolean | null | undefined
type Paths<T, Prefix extends string = '', Depth extends unknown[] = []> = Depth['length'] extends 7
  ? never
  : T extends Primitive
    ? never
    : T extends readonly (infer Item)[]
      ? Paths<Item, `${Prefix}[]`, [...Depth, 1]>
      : T extends object
        ? {
            [Key in keyof T & string]-?:
              `${Prefix}.${Key}` | Paths<NonNullable<T[Key]>, `${Prefix}.${Key}`, [...Depth, 1]>
          }[keyof T & string]
        : never

type Differences = {
  [Key in keyof Types]: {
    onlyInSchema: Exclude<Paths<Schemas[Key]>, Paths<Types[Key]>>
    onlyInType: Exclude<Paths<Types[Key]>, Paths<Schemas[Key]>>
  }
}
declare const differences: Differences
export const sameFields: { [Key in keyof Types]: { onlyInSchema: never; onlyInType: never } } =
  differences
