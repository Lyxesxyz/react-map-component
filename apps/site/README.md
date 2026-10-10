# Geospatial map — docs site

The documentation website of the geospatial map, published at <https://lyxesxyz.github.io/react-map-component/>. It shows the guides of both folders, a gallery of examples, and the two demos. It is built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build). Teams never copy it: the guides that travel with a folder stay in that folder, and this site renders them as they are.

## Pages

Every path is below the base, `/react-map-component/`. The `/react/` pages come from `packages/geospatial-map/src`, the `/angular/` pages from `packages/geospatial-map-angular/src`.

| Path                                  | What it is                                                        |
| ------------------------------------- | ----------------------------------------------------------------- |
| `/`                                   | The landing page (`src/content/docs/index.mdx`)                   |
| `/examples/`                          | The examples gallery                                              |
| `/examples/<id>/`                     | One example: the demo embedded, its example files and guides      |
| `/react/`, `/angular/`                | The folder's `README.md`                                          |
| `/react/guides/<name>/`, `/angular/…` | The eight guides in the folder's `docs/`                          |
| `/react/changelog/`, `/angular/…`     | The folder's `CHANGELOG.md`                                       |
| `/react/agents/`, `/angular/…`        | The folder's `AGENTS.md`                                          |
| `/demo/react/`, `/demo/angular/`      | The two demos, built for this path: static files, not Astro pages |

## How it is built

- **Guides.** The guides integration (`src/integrations/guides.mjs`, with `src/guides/`) copies each folder's `README.md`, `AGENTS.md`, `CHANGELOG.md` and `docs/*.md` into `src/content/docs/react/` and `src/content/docs/angular/`, before Astro loads the content. It runs in `dev`, `build` and `check` alike, and under `dev` it copies again when a source changes. Both folders are gitignored: never edit them. Each copy takes its title from the first line's `# Title`, its description from the first paragraph, and the date of the last commit to its source. Its links are rewritten: a link to another published file (a guide, `README.md`, `CHANGELOG.md`, `AGENTS.md`) becomes a link to its page, a link to an example or any other file of the folder points at that file on GitHub, and a link to a directory at its GitHub tree. A link that leaves the folder, starts at the root or names a missing file fails the copy, as does raw HTML with a relative `href` or `src`. The originals in `packages/*/src` are not changed (`src/CLAUDE.md` is not published).
- **Sidebar.** `src/sidebar.mjs` has three topics: React, Angular and Examples. The React and Angular sidebars follow `src/guides/catalog.mjs`, which lists each folder's guides in reading order with their sidebar labels; the Examples sidebar follows `src/data/examples.mjs`.
- **Demos.** The landing page and the example pages embed the demos in an `<iframe>` (`src/components/DemoFrame.astro`), at `<base>/demo/<react|angular>/?scenario=<id>&embed`. `?embed` shows only the map, filling the frame; it works with every scenario and with `theme=`, `dark`, `basemap=` and `projection=`. `scripts/build.mjs` runs `astro build`, then builds both demos for `<base>/demo/react/` and `<base>/demo/angular/` and copies them into `dist/demo/`.
- **Components.** `src/components/` holds the site's own parts: the demo frame, the React/Angular code tabs (`FrameworkTabs.astro`), the landing page's sections (`landing/`) and the gallery cards (`examples/`). Three of Starlight's components are overridden in `astro.config.mjs` (`components`): `Hero` (the landing page), `PageTitle` (the React/Angular switch on a folder's pages) and `Sidebar` (the topics as a switch). The reader's framework is remembered under Starlight's synced-tabs key (`starlight-synced-tabs__framework`), so frames, code tabs and guide pages agree.
- **Links.** `starlight-links-validator` checks the links and anchors of every Markdown page during `astro build`, the guides included, and the build fails on a broken one. It skips `<base>/demo/**`, which doesn't exist until the demos are copied in. It doesn't check the sidebar or the links in `.astro` files; the site's tests (`test/examples.test.ts`) check that each example's guide links name a generated page and heading.
- **URLs.** `site.config.mjs` holds the repository, the branch, the origin and the base. Every URL the site builds comes from there.
- **Telemetry.** `scripts/astro.mjs` runs the Astro CLI with telemetry off, because the repository's checks don't reach the network. The workflow sets `ASTRO_TELEMETRY_DISABLED` too.

## Commands

From the repository root:

```sh
pnpm dev:site       # http://localhost:4321/react-map-component/
pnpm dev:all        # in a second terminal: the demos the pages embed (React on 5173, Angular on 4200)
pnpm build:site     # the site and both demos into apps/site/dist (links checked)
pnpm preview:site   # serves apps/site/dist, demos included
pnpm --filter geospatial-map-site typecheck   # astro check (pnpm typecheck runs it too)
```

Under `pnpm dev:site` the demo folders don't exist, so the iframes load the demos' dev servers instead: `http://localhost:5173/` (React) and `http://localhost:4200/` (Angular). `PUBLIC_DEMO_REACT_URL` and `PUBLIC_DEMO_ANGULAR_URL` change them. `pnpm build:site` and `pnpm preview:site` use the built demos.

## Adding an example

1. The example is a demo scenario. A new scenario lands in both demos (`apps/demo-shared/src/scenarios.ts`, then each demo), like any demo change.
2. Add an entry to `src/data/examples.mjs`: the scenario's `id`, a `title` and a `summary`, what the map `shows` (the gallery card's small legend), the example files of each folder (`react`, `angular`), the guides that explain it, and what it loads from the network. Optional fields set extra query parameters, the views the page switches between, the frame's height, or `embed: false` for a scenario that needs the demo's own form. The JSDoc at the top lists every field.
3. The gallery card, the page at `/examples/<id>/` and the sidebar entry follow from the entry. The site's tests (`test/examples.test.ts`) check that the scenario exists, that the example files exist in each folder, and that each guide link names a generated page and heading.

## Adding a guide

1. Add `docs/<name>.md` to both folders, in plain GitHub Markdown: no frontmatter, a `# Title` on the first line, Markdown links relative inside the folder. `<name>` is lower case, with digits and hyphens only, because it is the page's address. The folders' guide tests check the links; the site's tests (`test/sync.test.ts`, in `pnpm test`) fail on frontmatter, a missing first-line title or a name in another form.
2. Add the guide to both frameworks' `guides` in `src/guides/catalog.mjs`, in reading order, with its sidebar label. A guide missing there is still published, after the listed ones, but a site test (`test/sync.test.ts`) fails until it is listed.

The page appears at `/react/guides/<name>/` and `/angular/guides/<name>/`, and in both sidebars. Nothing else changes.

## Starlight's own components

Starlight's `<Tabs>`, `<Steps>` and `<FileTree>` don't build in this workspace: they render through Astro's Sätteri Markdown processor, whose native binding can't be resolved from the prerendered chunk under pnpm ("Cannot find module '@bruits/satteri-…'"). Use the site's own components instead (`src/components/FrameworkTabs.astro` for React/Angular code). `<Code>`, which the example pages use, works.

## Deploying

`.github/workflows/docs-site.yml` builds the site with `pnpm build:site` and publishes `apps/site/dist` to GitHub Pages.

- A push to `main` that changes what the site is built from (`apps/`, `packages/`, the root `package.json`, the lockfile, the workflow) deploys it. A pull request that changes them only builds it, so a broken link or a failing demo build fails the pull request. The workflow can also be run by hand (Actions → Docs site → Run workflow).
- It checks out the full history: each page shows the date of the last commit to its source file.
- Before the first deploy, set Settings → Pages → Source to **GitHub Actions**, once. The `github-pages` environment that this creates deploys only from `main`; a run from another branch builds but doesn't deploy.

## Forks and custom domains

Edit `site.config.mjs`. GitHub Pages serves a project site at `https://<owner>.github.io/<repository>/`, so a fork sets `repository` to its own repository, `site` to `https://<owner>.github.io` and `base` to `/<repository>`.

A build can also take the origin and the base from the environment, without editing the file: `SITE_URL` sets the origin and `SITE_BASE` the base (`SITE_BASE=/` for a site at the root of its domain). For a custom domain, set the domain in Settings → Pages, and add `SITE_URL` and `SITE_BASE` to the build step's `env` in the workflow.
