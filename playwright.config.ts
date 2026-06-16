/**
 * Playwright configuration for liquid-glass-react cross-browser E2E suite.
 *
 * Architecture:
 * - Three projects: chromium, firefox, webkit (Desktop variants)
 * - webServer ONLY serves the pre-built storybook-static (does NOT build)
 * - The `e2e` npm script builds storybook FIRST, then runs `playwright test`
 *   avoiding the build-races-readiness bug.
 * - Visual screenshot baseline is pinned to chromium/darwin (platform-suffixed).
 *   CI visual-diff platform handling is deferred to plan 011.
 *
 * snapshotPathTemplate uses the default (platform-suffixed): the committed
 * darwin baselines live under e2e/<spec>-snapshots/*-darwin.png — do NOT add
 * the snapshots dir to .gitignore.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Fail the build on CI if test.only is left in source
  forbidOnly: !!process.env.CI,
  // Retry once on CI to surface genuine flakes vs real failures
  retries: process.env.CI ? 1 : 0,
  // Run tests in parallel across workers
  fullyParallel: true,
  // Reporter: list for terminal, html for post-run inspection
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    // All tests use the static Storybook server
    baseURL: 'http://localhost:6006',
    // Capture a screenshot + trace on first retry only (CI evidence)
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  // Global screenshot tolerance for toHaveScreenshot calls
  expect: {
    toHaveScreenshot: {
      // Allow up to 3% pixel diff for minor anti-aliasing / sub-pixel rounding
      maxDiffPixelRatio: 0.03,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /**
   * Web server: ONLY serves the pre-built storybook-static.
   * The `e2e` npm script is responsible for running `build-storybook` first.
   * reuseExistingServer: true locally so repeated runs skip the serve startup wait.
   */
  webServer: {
    command: 'pnpm exec http-server storybook-static -p 6006 -s -c-1',
    url: 'http://localhost:6006',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
