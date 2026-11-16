import { defineConfig, devices } from '@playwright/test';

// Browser journeys run against the production build (vite preview), per TASKS T19.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4719',
    trace: 'retain-on-failure',
    // T17: the water drifts by default. Journeys run with motion paused (a saved display preference) so the idle
    // scene stays still and software rendering is not saturated; tests/e2e/motion.spec.ts turns motion back on.
    storageState: 'tests/e2e/motion-paused.storage.json',
  },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: /zoom\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Real browser zoom needs a real window: no emulated viewport or device scale (T17).
      name: 'chromium-zoom',
      testMatch: /zoom\.spec\.ts/,
      use: { browserName: 'chromium', viewport: null },
    },
  ],
  // Dedicated port and no reuse: another project's preview once occupied 4173 and was silently tested instead.
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4719',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
