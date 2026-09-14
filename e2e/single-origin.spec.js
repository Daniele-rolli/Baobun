import { expect, test } from '@playwright/test'

test('a user can register and create a group on a mobile viewport', async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/register')

  await page.getByLabel('Full Name').fill('Mobile E2E User')
  await page.getByLabel('Email').fill(`mobile-e2e-${unique}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123!')
  await page.getByLabel('Confirm Password').fill('Test-password-123!')
  await page.getByRole('button', { name: 'Register' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  // First visit auto-opens the PWA install dialog, which aria-hides <main>.
  // Dismiss it like a user would before asserting on dashboard content.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Create a Group' })).toBeVisible()

  const groupName = `Mobile Group ${unique}`
  await page.getByPlaceholder('e.g., Math Class 2024').fill(groupName)
  await page.getByRole('button', { name: 'Create Group' }).click()
  await expect(page.getByText(groupName)).toBeVisible()
})

test('single-origin API supports groups, recurrence, import, and pull tokens', async ({
  request,
}) => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const register = await request.post('/api/auth/register', {
    data: {
      name: 'E2E User',
      email: `e2e-${unique}@example.com`,
      password: 'Test-password-123!',
    },
  })
  expect(register.ok()).toBeTruthy()
  const sessionCookie = register.headers()['set-cookie']?.split(';', 1)[0]
  expect(sessionCookie).toContain('baobun_sid=')

  const groupResponse = await request.post('/api/groups', {
    headers: { Cookie: sessionCookie },
    data: { name: `E2E Group ${unique}`, color: '#f43f5e' },
  })
  expect(groupResponse.status()).toBe(201)
  const { group } = await groupResponse.json()
  expect(group.role).toBe('OWNER')

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const recurring = await request.post(`/api/groups/${group.id}/events`, {
    headers: { Cookie: sessionCookie },
    data: {
      title: 'Recurring standup',
      start: start.toISOString(),
      end: end.toISOString(),
      recurrence: { frequency: 'WEEKLY', interval: 1, count: 3 },
      reminderMinutes: 30,
    },
  })
  expect(recurring.status()).toBe(201)
  expect((await recurring.json()).occurrenceCount).toBe(3)

  const toIcsDate = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:import-${unique}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    'SUMMARY:Imported event',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const imported = await request.post(`/api/groups/${group.id}/events/import`, {
    headers: { Cookie: sessionCookie },
    multipart: {
      file: {
        name: 'calendar.ics',
        mimeType: 'text/calendar',
        buffer: Buffer.from(calendar),
      },
    },
  })
  const importResult = await imported.json()
  expect(imported.ok(), JSON.stringify(importResult)).toBeTruthy()
  expect(importResult.imported).toBe(1)

  const tokenResponse = await request.post('/api/tokens', {
    headers: { Cookie: sessionCookie },
    data: { name: 'E2E integration' },
  })
  expect(tokenResponse.status()).toBe(201)
  const { secret } = await tokenResponse.json()

  const pulled = await request.get(`/api/v1/groups/${group.id}/events`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  expect(pulled.ok()).toBeTruthy()
  const payload = await pulled.json()
  expect(payload.events).toHaveLength(4)
  expect(payload.events.some((event) => event.title === 'Imported event')).toBeTruthy()
})
