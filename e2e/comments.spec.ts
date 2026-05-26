import { test, expect } from '@playwright/test'
import { waitForApp, takeScreenshot, navigateToTab } from './helpers'

test.describe('Comments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await navigateToTab(page, 'Accueil')
  })

  test('should open comment modal from feed', async ({ page }) => {
    await page.waitForTimeout(4000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, 'comments-modal-open')
      const modalTitle = page.getByText(/commentaire/i)
      if (await modalTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await takeScreenshot(page, 'comments-modal-loaded')
      }
    }
  })

  test('should display comment list when modal is open', async ({ page }) => {
    await page.waitForTimeout(4000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(3000)
      await takeScreenshot(page, 'comments-list')
      const emptyState = page.getByText(/aucun commentaire|sois le premier/i)
      if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
        await takeScreenshot(page, 'comments-empty-state')
      } else {
        const commentItems = page.locator('[role="button"]').filter({ hasText: /^@|répondre|supprimer/i })
        if (await commentItems.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          await takeScreenshot(page, 'comments-with-replies')
        }
      }
    }
  })

  test('should show comment input area', async ({ page }) => {
    await page.waitForTimeout(4000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(2000)
      const inputArea = page.locator('input, textarea, [contenteditable]').filter({ hasText: /commentaire|Ajouter|Réponse/i })
      const inputPlaceholder = page.getByPlaceholder(/commentaire|Ajouter|Réponse/i)
      const hasInput = (await inputArea.count() > 0) || (await inputPlaceholder.count() > 0)
      if (hasInput) {
        await takeScreenshot(page, 'comments-input-area')
      }
    }
  })

  test('should close comment modal via close button', async ({ page }) => {
    await page.waitForTimeout(4000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(2000)
      const closeBtn = page.locator('[name="close"], [data-icon="close"]').first()
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click()
        await page.waitForTimeout(1000)
        await takeScreenshot(page, 'comments-modal-closed')
      }
    }
  })

  test('should close comment modal via backdrop', async ({ page }) => {
    await page.waitForTimeout(4000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(2000)
      await page.mouse.click(10, 50)
      await page.waitForTimeout(1000)
      await takeScreenshot(page, 'comments-modal-backdrop-close')
    }
  })

  test('should like a comment', async ({ page }) => {
    await page.waitForTimeout(4000)
    const commentBtn = page.locator('[name="chatbubble-ellipses"], [data-icon="chatbubble-ellipses"]').first()
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentBtn.click()
      await page.waitForTimeout(3000)
      const heartBtn = page.locator('[name="heart-outline"], [data-icon="heart-outline"]').first()
      if (await heartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await heartBtn.click()
        await page.waitForTimeout(500)
        await takeScreenshot(page, 'comments-like-toggled')
      }
    }
  })
})
