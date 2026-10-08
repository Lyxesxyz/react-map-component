// Writes the JSON Schemas of the configuration from the same TypeBox objects the component
// validates with, so the published schemas cannot drift from runtime validation:
// `map-config.schema.json` (the complete `MapConfig`) and `map-config-input.schema.json` (the
// short form people write, `MapConfigInput`, for editors and CMS fields). The schemas come from
// the shared core (packages/geospatial-map-core), so they are the same for the React and the
// Angular folder, and are written next to it by default.
// Usage: pnpm schema [output-directory]
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const directory = path.resolve(process.argv[2] ?? 'packages/geospatial-map-core')
const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, ws: false },
})
try {
  const { mapConfigSchema, mapInputSchema } = await server.ssrLoadModule(
    '/packages/geospatial-map-core/src/config/schema.ts',
  )
  for (const [file, schema] of [
    ['map-config.schema.json', mapConfigSchema],
    ['map-config-input.schema.json', mapInputSchema],
  ]) {
    const output = path.join(directory, file)
    writeFileSync(output, `${JSON.stringify(schema, null, 2)}\n`)
    console.log(`Wrote ${path.relative(process.cwd(), output)}`)
  }
} finally {
  await server.close()
}
