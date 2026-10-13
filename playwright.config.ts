import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against a production build of the app with Socrata replaced
// by the mock server in tests/mock-socrata, so they are deterministic and
// never hit the public open-data API.
const APP_PORT = 3100;
const MOCK_PORT = 4545;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Phone emulation on Chromium (no WebKit download needed in CI).
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", defaultBrowserType: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `node tests/mock-socrata/server.mjs ${MOCK_PORT}`,
      url: `http://127.0.0.1:${MOCK_PORT}/health`,
      // CI starts the mock before `next build` (prerendering needs it); reuse it here.
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: `pnpm start -p ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}/about`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        SOCRATA_ORIGIN_OVERRIDE: `http://127.0.0.1:${MOCK_PORT}`,
      },
    },
  ],
});
