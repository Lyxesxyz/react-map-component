// Runs an Angular CLI build target through the Architect API, without the `ng` binary. The
// paste test uses it for the Angular 22 app when this Node.js is older than the Angular 22 CLI
// accepts (it checks `engines`, ^22.22.3 || ^24.15.0 || >=26, before doing anything): the
// builder itself runs fine. The packages come from the app's own node_modules.
//
// Usage: node scripts/angular-architect-build.mjs <app directory> [project] [target] [configuration]
import { createRequire } from 'node:module'
import path from 'node:path'

const [directory, project = 'consumer', target = 'build', configuration = 'production'] =
  process.argv.slice(2)
if (!directory) {
  console.error('Usage: node scripts/angular-architect-build.mjs <app> [project] [target] [config]')
  process.exit(2)
}

const app = path.resolve(directory)
const require = createRequire(path.join(app, 'package.json'))
const { Architect } = require('@angular-devkit/architect')
const { WorkspaceNodeModulesArchitectHost } = require('@angular-devkit/architect/node')
const { logging, schema, workspaces } = require('@angular-devkit/core')
const { NodeJsSyncHost } = require('@angular-devkit/core/node')
const { lastValueFrom } = require('rxjs')

const { workspace } = await workspaces.readWorkspace(
  app,
  workspaces.createWorkspaceHost(new NodeJsSyncHost()),
)
const registry = new schema.CoreSchemaRegistry()
registry.addPostTransform(schema.transforms.addUndefinedDefaults)
registry.useXDeprecatedProvider((message) => console.warn(message))
const architect = new Architect(new WorkspaceNodeModulesArchitectHost(workspace, app), registry)

const logger = new logging.IndentLogger('build')
logger.subscribe((entry) => {
  const write = entry.level === 'error' || entry.level === 'fatal' ? console.error : console.log
  write(entry.message)
})

const run = await architect.scheduleTarget({ project, target, configuration }, {}, { logger })
const result = await lastValueFrom(run.output)
await run.stop()
process.exitCode = result.success ? 0 : 1
