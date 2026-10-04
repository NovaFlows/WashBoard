import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'booking-refonte.spec.ts',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3017', ...devices['iPhone 13'], browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --port 3017',
    env: { BOOKING_UI_PREVIEW: '1' },
    url: 'http://localhost:3017/dev/booking-preview',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
