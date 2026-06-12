import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5199",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // WebKit = the Safari engine: the agreed Safari proxy for criterion 6.
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
