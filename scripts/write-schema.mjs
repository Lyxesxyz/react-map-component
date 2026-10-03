// Writes the JSON Schema for GeospatialMapConfigV1 from the same TypeBox object the
// component validates with, so the published schema cannot drift from runtime validation.
// Usage: pnpm schema [output-path]
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const output = path.resolve(process.argv[2] ?? 'packages/geospatial-map/map-config.schema.json')
const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, ws: false },
})
try {
  const { mapConfigSchema } = await server.ssrLoadModule('/packages/geospatial-map/src/config.ts')
  writeFileSync(output, `${JSON.stringify(mapConfigSchema, null, 2)}\n`)
  console.log(`Wrote ${path.relative(process.cwd(), output)}`)
} finally {
  await server.close()
}
