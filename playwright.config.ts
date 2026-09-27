import { defineConfig, devices } from "@playwright/test";

// Playwright doesn't read .env.local by itself.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local (e.g. on a CI server): use the real environment variables
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Use an installed browser instead of downloading one, e.g. PW_CHANNEL=msedge on Windows.
const channel = process.env.PW_CHANNEL || undefined;

/**
 * Smoke tests: `npm run test:e2e` (see README → Tests).
 * Signs in as E2E_EMAIL and opens every page on a desktop and a phone screen.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL, trace: "retain-on-failure", channel },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        channel,
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
