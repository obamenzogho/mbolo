import { test } from '@playwright/test'
import { waitForApp, takeScreenshot, SCREENSHOT_DIR } from './helpers'
import fs from 'fs'

test.describe('Automatic Screenshots', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    }
  })

  test('capture app shell', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(3000)
    await takeScreenshot(page, '01-app-shell')
  })

  test('capture auth screen', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(4000)
    const loginBtn = page.getByText(/se connecter|connexion|login|inscrire|register/i)
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeScreenshot(page, '02-auth-screen')
    } else {
      await takeScreenshot(page, '02-authenticated-state')
    }
  })

  test('capture feed', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(5000)
    await takeScreenshot(page, '03-feed-view')
  })

  test('capture feed with mode toggle', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(5000)
    await takeScreenshot(page, '04-feed-full')
  })

  test('capture comments modal', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(5000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '05-comments-modal')
    }
  })

  test('capture upload screen', async ({ page }) => {
    await page.goto('/upload')
    await page.waitForTimeout(3000)
    await takeScreenshot(page, '06-upload-screen')
  })

  test('capture post screen', async ({ page }) => {
    await page.goto('/post?mediaType=image&mediaUri=https://picsum.photos/400/600')
    await page.waitForTimeout(3000)
    await takeScreenshot(page, '07-post-screen')
  })

  test('capture notifications tab', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(4000)
    const notifTab = page.getByRole('tab', { name: /notification/i })
    if (await notifTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await notifTab.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '08-notifications')
    }
  })

  test('capture profile tab', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(4000)
    const profileTab = page.getByRole('tab', { name: /profil|profile/i })
    if (await profileTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileTab.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '09-profile')
    }
  })

  test('capture messages tab', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(4000)
    const msgTab = page.getByRole('tab', { name: /message/i })
    if (await msgTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await msgTab.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '10-messages')
    }
  })

  test('capture stories tab', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(4000)
    const storiesTab = page.getByRole('tab', { name: /stories|story/i })
    if (await storiesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await storiesTab.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, '11-stories')
    }
  })

  test('capture welcome screen for new users', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.waitForTimeout(4000)
    const emptyState = page.getByText(/aucune vidéo|sois le premier/i)
    if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeScreenshot(page, '12-empty-feed')
    }
  })
})
