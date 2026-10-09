// Copies the shared demo data (apps/demo-shared/public: the /data/… files the scenarios load)
// into this app's public/ folder, which angular.json serves at the site root. The Angular CLI
// takes asset folders only from inside the app, so the copy is the Angular demo's counterpart
// of the React demo's `publicDir: '../demo-shared/public'`. public/ is generated and gitignored;
// the "dev" and "build" scripts run this first.
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(app, '../demo-shared/public')
const target = join(app, 'public')

// Overwrite in place (a running dev server keeps serving every file), then drop what the
// shared folder no longer has.
cpSync(source, target, { recursive: true, force: true })

function prune(copy, original) {
  for (const entry of readdirSync(copy, { withFileTypes: true })) {
    const copied = join(copy, entry.name)
    const shared = join(original, entry.name)
    if (!existsSync(shared)) rmSync(copied, { recursive: true, force: true })
    else if (entry.isDirectory()) prune(copied, shared)
  }
}
prune(target, source)
