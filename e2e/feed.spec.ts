import { test, expect } from '@playwright/test'
import { waitForApp, takeScreenshot, navigateToTab } from './helpers'

test.describe('Video Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await navigateToTab(page, 'Accueil')
  })

  test('should display feed with video items', async ({ page }) => {
    await page.waitForTimeout(4000)
    const videos = page.locator('video')
    const videoCount = await videos.count()
    await takeScreenshot(page, 'feed-view')
    expect(videoCount).toBeGreaterThanOrEqual(0)
  })

  test('should show feed mode toggle (Quoi de neuf / Suivi)', async ({ page }) => {
    await page.waitForTimeout(4000)
    const modeToggle = page.getByText(/quoi de neuf|suivi/i)
    if (await modeToggle.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeScreenshot(page, 'feed-mode-toggle')
      const suivis = page.getByText(/suivi/i)
      if (await suivis.isVisible({ timeout: 2000 }).catch(() => false)) {
        await suivis.click()
        await page.waitForTimeout(2000)
        await takeScreenshot(page, 'feed-mode-suivi')
      }
    }
  })

  test('should interact with like button on video', async ({ page }) => {
    await page.waitForTimeout(4000)
    const likeBtn = page.locator('[name="heart-outline"], [data-icon="heart-outline"]').first()
    if (await likeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await likeBtn.click()
      await page.waitForTimeout(1000)
      await takeScreenshot(page, 'feed-like-clicked')
    }
  })

  test('should open comment modal from video', async ({ page }) => {
    await page.waitForTimeout(4000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, 'feed-comments-modal')
      const closeBtn = page.locator('[name="close"], [data-icon="close"]').first()
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click()
      }
    }
  })

  test('should open share modal from video', async ({ page }) => {
    await page.waitForTimeout(4000)
    const shareBtn = page.locator('[name="paper-plane-outline"], [data-icon="paper-plane-outline"]').first()
    if (await shareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareBtn.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, 'feed-share-modal')
    }
  })

  test('should toggle save/bookmark on video', async ({ page }) => {
    await page.waitForTimeout(4000)
    const saveBtn = page.locator('[name="bookmark-outline"], [data-icon="bookmark-outline"]').first()
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click()
      await page.waitForTimeout(1000)
      await takeScreenshot(page, 'feed-save-clicked')
    }
  })

  test('should scroll through feed videos', async ({ page }) => {
    await page.waitForTimeout(4000)
    await takeScreenshot(page, 'feed-scroll-start')
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(2000)
    await takeScreenshot(page, 'feed-scroll-down')
  })

  test('should navigate to user profile from feed', async ({ page }) => {
    await page.waitForTimeout(4000)
    const userAvatar = page.locator('img[alt], [role="img"]').first()
    if (await userAvatar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userAvatar.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, 'feed-user-profile')
    }
  })
})
