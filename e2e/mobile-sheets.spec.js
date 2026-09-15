import { expect, test } from '@playwright/test'

async function register(page, unique, name) {
  await page.goto('/register')

  await page.getByLabel('Full Name').fill(name)
  await page.getByLabel('Email').fill(`sheet-e2e-${unique}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123!')
  await page.getByLabel('Confirm Password').fill('Test-password-123!')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function createGroupAndOpen(page, unique) {
  const groupName = `Sheet Group ${unique}`
  await page.getByPlaceholder('e.g., Math Class 2024').fill(groupName)
  await page.getByRole('button', { name: 'Create Group' }).click()
  await expect(page.getByText(groupName)).toBeVisible()
  await page.getByText(groupName).click()
  await expect(page).toHaveURL(/\/group\//)
}

// Group.vue attaches the baobun:add-event listener at the end of its async
// mount, so a trigger fired right after navigation can land before the
// listener exists. Re-fire until the modal shell is present.
async function waitForShell(page, slot, trigger) {
  await expect
    .poll(
      async () => {
        if ((await page.locator(`[data-slot="${slot}"]`).count()) === 0) {
          await trigger()
          await page.waitForTimeout(1000)
        }
        return await page.locator(`[data-slot="${slot}"]`).count()
      },
      { timeouts: [15000] },
    )
    .toBe(1)
}

test('event modal opens as a bottom sheet on a mobile viewport', async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  await page.setViewportSize({ width: 390, height: 844 })
  await register(page, unique, 'Sheet E2E User')
  await createGroupAndOpen(page, unique)

  // Mobile FAB "Add event" from Navigator.vue dispatches baobun:add-event,
  // which Group.vue listens for to open EventModal.
  const fab = page.getByRole('button', { name: 'Add event' })
  await waitForShell(page, 'drawer-content', () => fab.click())

  const sheet = page.locator('[data-slot="drawer-content"]')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Add New Event')).toBeVisible()
})

test('event modal opens as a dialog (not a sheet) on a desktop viewport', async ({
  page,
}) => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  await page.setViewportSize({ width: 1280, height: 800 })
  await register(page, unique, 'Sheet E2E Desktop User')
  await createGroupAndOpen(page, unique)

  // Same open path as the mobile FAB (Group.vue baobun:add-event listener);
  // the FAB itself is md:hidden so fire the event directly.
  await waitForShell(page, 'dialog-content', () =>
    page.evaluate(() => window.dispatchEvent(new CustomEvent('baobun:add-event'))),
  )

  const dialog = page.locator('[data-slot="dialog-content"]')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Add New Event')).toBeVisible()
  await expect(page.locator('[data-slot="drawer-content"]')).toHaveCount(0)
})
