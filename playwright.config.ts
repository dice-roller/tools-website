import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "npm run generate && http-server .output/public -a 127.0.0.1 -p 4173 -c-1",
    url: baseURL,
    env: {
      NUXT_PUBLIC_DOCUMENTATION_BASE_URL:
        process.env.NUXT_PUBLIC_DOCUMENTATION_BASE_URL ??
        "https://dice-roller.github.io/documentation/",
    },
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
