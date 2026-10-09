// `@carbon/icons` ships its icon descriptors (`@carbon/icons/es/<name>/<size>.js`) without types.
declare module '@carbon/icons/es/*' {
  /** A Carbon icon: the svg's attributes (view box, fill, size) and the nodes inside it. */
  const icon: {
    elem: 'svg'
    attrs: Record<string, string | number>
    content: { elem: string; attrs: Record<string, string | number> }[]
    name: string
    size: number
  }
  export default icon
}
