import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SESSION_FILE = path.join(__dirname, '.washer-session.json')

setup('authentification laveur', async ({ page }) => {
  const email    = process.env.TEST_WASHER_EMAIL
  const password = process.env.TEST_WASHER_PASSWORD

  if (!email || !password) {
    console.warn('⚠️  TEST_WASHER_EMAIL / TEST_WASHER_PASSWORD absents — session vide créée')
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies: [], origins: [] }))
    return
  }

  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
  await expect(page).toHaveURL(/\/dashboard/)
  await page.context().storageState({ path: SESSION_FILE })
})
