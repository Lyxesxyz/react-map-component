import { ChangeDetectionStrategy, Component, Directive, input } from '@angular/core'
import add from '@carbon/icons/es/add/16.js'
import arrowDown from '@carbon/icons/es/arrow--down/16.js'
import arrowUp from '@carbon/icons/es/arrow--up/16.js'
import chevronDown from '@carbon/icons/es/chevron--down/16.js'
import chevronLeft from '@carbon/icons/es/chevron--left/16.js'
import chevronRight from '@carbon/icons/es/chevron--right/16.js'
import close from '@carbon/icons/es/close/16.js'
import fitToScreen from '@carbon/icons/es/fit-to-screen/16.js'
import layers from '@carbon/icons/es/layers/16.js'
import locationCurrent from '@carbon/icons/es/location--current/16.js'
import maximize from '@carbon/icons/es/maximize/16.js'
import pauseFilled from '@carbon/icons/es/pause--filled/16.js'
import playFilledAlt from '@carbon/icons/es/play--filled--alt/16.js'
import renew from '@carbon/icons/es/renew/16.js'
import restart from '@carbon/icons/es/restart/16.js'
import settingsAdjust from '@carbon/icons/es/settings--adjust/16.js'
import subtract from '@carbon/icons/es/subtract/16.js'
import zoomReset from '@carbon/icons/es/zoom--reset/16.js'
import type { MapIcons, MapSvgIcon } from '@/components/geospatial-map'

// The icon sets of the themes scenario, the two kinds of map icon side by side:
// - Carbon: `@carbon/icons` descriptors turned into SVG node lists by `carbonIcon()` (the React
//   demo uses @carbon/icons-react). Carbon icons are filled, on a 16 or 32 view box, so each list
//   starts with the svg's own attributes, which replace lucide's defaults.
// - Material: icon components, one per icon (the React demo uses react-icons/md). Each is the
//   svg itself (`svg[appMd…]`), with react-icons' attributes and Google's Material Design paths
//   (Apache-2.0), and takes the `class` the map gives it (`geo-spin` on the spinner).

/** A `@carbon/icons` descriptor (`@carbon/icons/es/<name>/16.js`). */
type CarbonIcon = typeof add

/** A Carbon descriptor as a node list, with the attributes @carbon/icons-react gives its svg. */
function carbonIcon({ attrs, content }: CarbonIcon): MapSvgIcon {
  return [
    ['svg', { focusable: 'false', preserveAspectRatio: 'xMidYMid meet', ...attrs }],
    ...content.map(({ elem, attrs }): MapSvgIcon[number] => [elem, attrs]),
  ]
}

export const carbonIcons: MapIcons = {
  ZoomIn: carbonIcon(add),
  ZoomOut: carbonIcon(subtract),
  ResetZoom: carbonIcon(zoomReset),
  Locate: carbonIcon(locationCurrent),
  Spinner: carbonIcon(renew),
  Layers: carbonIcon(layers),
  Fit: carbonIcon(fitToScreen),
  Settings: carbonIcon(settingsAdjust),
  Fullscreen: carbonIcon(maximize),
  Close: carbonIcon(close),
  Collapse: carbonIcon(chevronDown),
  Expand: carbonIcon(chevronRight),
  MoveUp: carbonIcon(arrowUp),
  MoveDown: carbonIcon(arrowDown),
  Previous: carbonIcon(chevronLeft),
  Next: carbonIcon(chevronRight),
  Play: carbonIcon(playFilledAlt),
  Pause: carbonIcon(pauseFilled),
  Replay: carbonIcon(restart),
}

/** What every Material icon shares: the svg attributes react-icons renders, and the map's class. */
@Directive({
  host: {
    stroke: 'currentColor',
    fill: 'currentColor',
    'stroke-width': '0',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    height: '1em',
    width: '1em',
    xmlns: 'http://www.w3.org/2000/svg',
    '[attr.class]': 'class() ?? null',
  },
})
abstract class MaterialIcon {
  /** Set by the map: `geo-spin` on the spinner. */
  readonly class = input<string>()
}

/** The empty 24×24 path every react-icons Material icon starts with. */
const box = '<svg:path fill="none" d="M0 0h24v24H0z" />'

@Component({
  selector: 'svg[appMdAdd]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />',
})
export class MdAdd extends MaterialIcon {}

@Component({
  selector: 'svg[appMdRemove]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="M19 13H5v-2h14z" />',
})
export class MdRemove extends MaterialIcon {}

@Component({
  selector: 'svg[appMdFilterCenterFocus]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="M5 15H3v4c0 1.1.9 2 2 2h4v-2H5zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2m0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3" />',
})
export class MdFilterCenterFocus extends MaterialIcon {}

@Component({
  selector: 'svg[appMdMyLocation]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7" />',
})
export class MdMyLocation extends MaterialIcon {}

@Component({
  selector: 'svg[appMdAutorenew]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.9 5.9 0 0 1 6 12c0-3.31 2.69-6 6-6m6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26" />',
})
export class MdAutorenew extends MaterialIcon {}

@Component({
  selector: 'svg[appMdLayers]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="m11.99 18.54-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27z" />',
})
export class MdLayers extends MaterialIcon {}

@Component({
  selector: 'svg[appMdFitScreen]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="M17 4h3c1.1 0 2 .9 2 2v2h-2V6h-3zM4 8V6h3V4H4c-1.1 0-2 .9-2 2v2zm16 8v2h-3v2h3c1.1 0 2-.9 2-2v-2zM7 18H4v-2H2v2c0 1.1.9 2 2 2h3zM18 8H6v8h12z" />',
})
export class MdFitScreen extends MaterialIcon {}

@Component({
  selector: 'svg[appMdTune]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z" />',
})
export class MdTune extends MaterialIcon {}

@Component({
  selector: 'svg[appMdFullscreen]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box + '<svg:path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z" />',
})
export class MdFullscreen extends MaterialIcon {}

@Component({
  selector: 'svg[appMdClose]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />',
})
export class MdClose extends MaterialIcon {}

@Component({
  selector: 'svg[appMdExpandMore]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />',
})
export class MdExpandMore extends MaterialIcon {}

@Component({
  selector: 'svg[appMdChevronRight]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />',
})
export class MdChevronRight extends MaterialIcon {}

@Component({
  selector: 'svg[appMdChevronLeft]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />',
})
export class MdChevronLeft extends MaterialIcon {}

@Component({
  selector: 'svg[appMdArrowUpward]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="m4 12 1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8z" />',
})
export class MdArrowUpward extends MaterialIcon {}

@Component({
  selector: 'svg[appMdArrowDownward]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="m20 12-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z" />',
})
export class MdArrowDownward extends MaterialIcon {}

@Component({
  selector: 'svg[appMdPlayArrow]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="M8 5v14l11-7z" />',
})
export class MdPlayArrow extends MaterialIcon {}

@Component({
  selector: 'svg[appMdPause]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: box + '<svg:path d="M6 19h4V5H6zm8-14v14h4V5z" />',
})
export class MdPause extends MaterialIcon {}

@Component({
  selector: 'svg[appMdReplay]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    box +
    '<svg:path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8" />',
})
export class MdReplay extends MaterialIcon {}

export const materialIcons: MapIcons = {
  ZoomIn: MdAdd,
  ZoomOut: MdRemove,
  ResetZoom: MdFilterCenterFocus,
  Locate: MdMyLocation,
  Spinner: MdAutorenew,
  Layers: MdLayers,
  Fit: MdFitScreen,
  Settings: MdTune,
  Fullscreen: MdFullscreen,
  Close: MdClose,
  Collapse: MdExpandMore,
  Expand: MdChevronRight,
  MoveUp: MdArrowUpward,
  MoveDown: MdArrowDownward,
  Previous: MdChevronLeft,
  Next: MdChevronRight,
  Play: MdPlayArrow,
  Pause: MdPause,
  Replay: MdReplay,
}
