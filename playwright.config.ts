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
    // Functional flow across the three engines — runs in parallel; these
    // tests tolerate GPU/CPU contention between browser projects.
    { name: "chromium", testMatch: /flow\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", testMatch: /flow\.spec\.ts/, use: { ...devices["Desktop Firefox"] } },
    // WebKit = the Safari engine: the agreed Safari proxy for criterion 6.
    { name: "webkit", testMatch: /flow\.spec\.ts/, use: { ...devices["Desktop Safari"] } },
    // Design audit (D2) + perf trace (D4). D4 measures real GPU frame timing,
    // which is corrupted if other browser projects render concurrently. This
    // project depends on the flow projects so it runs ALONE after they finish,
    // giving the perf measurement an uncontended GPU. Hardware WebGL via ANGLE
    // (not SwiftShader software rendering) so the trace reflects real GPU perf.
    {
      name: "design",
      testMatch: /design\.spec\.ts/,
      dependencies: ["chromium", "firefox", "webkit"],
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--use-gl=angle", "--use-angle=d3d11"] },
      },
    },
  ],
});
