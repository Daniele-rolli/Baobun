import { chromium } from 'playwright'

const OUT = '/var/folders/1t/6v9m28q14vx3tdz9v7xyjn3m0000gn/T/opencode'
const BASE = 'http://127.0.0.1:4173'

const browser = await chromium.launch()

// Desktop: login
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/shot-login.png` })
  await page.close()
}

// Desktop: register -> dashboard (empty state)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/shot-register.png` })
  await page.getByLabel(/name/i).fill('Shot User')
  await page.getByLabel(/email/i).fill('shot@example.com')
  await page.getByLabel(/password/i).first().fill('password123')
  await page.getByRole('button', { name: /create|sign up|register/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/shot-dashboard.png` })
  await page.close()
}

// Mobile: dashboard
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel(/email/i).fill('shot@example.com')
  await page.getByLabel(/password/i).fill('password123')
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/shot-dashboard-mobile.png` })
  await page.close()
}

await browser.close()
console.log('shots done')
