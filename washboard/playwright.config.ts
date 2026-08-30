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

// Port configurable : le 3000 est souvent déjà pris par un autre projet sur la
// machine de dev, et Playwright testait alors l'autre application sans le dire
// (`reuseExistingServer`), avec des échecs incompréhensibles à la clé.
// `E2E_PORT=3003 npx playwright test` pour cibler un serveur déjà lancé.
const PORT = process.env.E2E_PORT ?? '3000'
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
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
    {
      // Contenu public sans session : blog, pages légales, SEO, API publiques,
      // et les écrans d'authentification vus par un visiteur non connecté.
      name: 'public',
      testMatch: /(content-seo|api-public|auth-public)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 3. Tests laveur — nécessite l'authentification
    {
      name: 'washer',
      // Tout ce qui exige une session laveur : le dashboard et l'administration
      // de la page client. Un seul projet plutôt qu'un par fichier — la session
      // et les dépendances sont identiques.
      testMatch: /(washer|dashboard-.*|admin-.*)\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: SESSION_FILE,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
