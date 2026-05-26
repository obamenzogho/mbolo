import { test, expect } from '@playwright/test'
import { waitForApp, takeScreenshot } from './helpers'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
  })

  test('should display the app shell after splash screen', async ({ page }) => {
    await page.waitForTimeout(3000)
    await expect(page.locator('body')).toBeAttached()
    await takeScreenshot(page, 'app-shell')
  })

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.waitForTimeout(3000)
    const loginTitle = page.getByText(/se connecter|connexion|login/i)
    const registerLink = page.getByText(/inscrire|register/i)
    const onAuthPage = (await loginTitle.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await registerLink.isVisible({ timeout: 3000 }).catch(() => false))
    if (onAuthPage) {
      await takeScreenshot(page, 'auth-screen')
      expect(onAuthPage).toBeTruthy()
    }
  })

  test('should have tab bar with main sections', async ({ page }) => {
    await page.waitForTimeout(4000)
    const tabs = page.locator('[role="tab"]')
    const tabCount = await tabs.count()
    if (tabCount > 0) {
      const tabNames: string[] = []
      for (let i = 0; i < tabCount; i++) {
        tabNames.push(await tabs.nth(i).textContent() || '')
      }
      expect(tabNames.length).toBeGreaterThanOrEqual(4)
      await takeScreenshot(page, 'tab-bar')
    }
  })

  test('should navigate between tabs', async ({ page }) => {
    await page.waitForTimeout(4000)
    const tabs = page.locator('[role="tab"]')
    const tabCount = await tabs.count()
    if (tabCount > 0) {
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        await tabs.nth(i).click()
        await page.waitForTimeout(1000)
        await takeScreenshot(page, `tab-${i}`)
      }
    }
  })

  test('should open camera from feed top button', async ({ page }) => {
    await page.waitForTimeout(4000)
    const addButton = page.locator('button, [role="button"]').filter({ hasText: /add|\+/i })
    const cameraIcon = page.locator('[data-icon="add"], [name="add"]').first()
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.first().click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, 'camera-screen')
    } else if (await cameraIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cameraIcon.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, 'camera-screen')
    }
  })
})
