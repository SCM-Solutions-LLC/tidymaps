import { defineConfig } from 'playwright/test';

/* E2E config. The app is a static ES-module site with no build step, so the
   web server is just python's http.server on port 8123 (an origin the edge
   functions' CORS list already allows for local work).

   Locally, point CHROMIUM_PATH at a system Chromium if the Playwright-managed
   download isn't present (e.g. CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/
   chrome-linux/chrome). CI installs the matching browser instead. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:8123',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },
  webServer: {
    command: 'python3 -m http.server 8123',
    port: 8123,
    reuseExistingServer: !process.env.CI,
  },
});
