import { expect, test } from '@playwright/test'

// Every project but parity runs this check: the server at the project's baseURL must be the demo
// the project names in playwright.config.ts (`metadata.framework`, and `metadata.zone` for the
// zone.js server). A wrong baseURL, or a port already taken by the other demo's server, fails
// here instead of silently running the whole suite against the other demo.

test('the server at baseURL is the demo this project names', async ({ page }, testInfo) => {
  const { framework, zone = false } = testInfo.project.metadata as {
    framework?: string
    zone?: boolean
  }
  expect(['react', 'angular'], `metadata.framework of ${testInfo.project.name}`).toContain(
    framework,
  )
  const server = `${framework} demo at ${testInfo.project.use.baseURL}`
  await page.goto('/?scenario=quickstart')
  // Both demos render the same map; once it is there, Angular's root carries `ng-version`.
  await expect(page.locator('[data-slot="map"]').first()).toBeAttached()
  expect(await page.locator('[ng-version]').count(), server).toBe(framework === 'angular' ? 1 : 0)
  // Only the zone project's server loads zone.js.
  expect(await page.evaluate(() => typeof (window as { Zone?: unknown }).Zone), server).toBe(
    zone ? 'function' : 'undefined',
  )
})
