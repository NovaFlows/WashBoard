import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'

// Charge .env.test.local si présent (credentials de test, jamais committé)
try {
  const lines = fs.readFileSync('.env.test.local', 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
} catch { /* fichier absent → variables à passer manuellement */ }

const SESSION_FILE = 'e2e/.washer-session.json'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
  },
  projects: [
    // 1. Authentification — sauvegarde la session laveur
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 2. Tests publics (santé, landing, pages légales, booking client)
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'client',
      testMatch: /client-booking\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 3. Tests laveur — nécessite l'authentification
    {
      name: 'washer',
      testMatch: /washer\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: SESSION_FILE,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
