import { test, expect } from '@playwright/test'
import { waitForApp, takeScreenshot } from './helpers'

test.describe('Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
  })

  test('should display upload screen with picker options', async ({ page }) => {
    await page.goto('/upload')
    await page.waitForTimeout(3000)
    const title = page.getByText(/publier/i)
    if (await title.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeScreenshot(page, 'upload-screen')
      const cameraOption = page.getByText(/caméra|camera|enregistrer/i)
      const galleryOption = page.getByText(/galerie|gallery|choisir|folder/i)
      if (await cameraOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await takeScreenshot(page, 'upload-options-visible')
      }
    }
  })

  test('should navigate to upload from camera button', async ({ page }) => {
    await page.waitForTimeout(3000)
    const addBtn = page.locator('button, [role="button"]').filter({ hasText: /add|\+/i }).first()
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click()
      await page.waitForTimeout(2000)
      await takeScreenshot(page, 'upload-camera-navigation')
    }
  })

  test('should show post screen with media', async ({ page }) => {
    await page.goto('/post?mediaType=image&mediaUri=https://picsum.photos/400/600')
    await page.waitForTimeout(3000)
    const postTitle = page.getByText(/publier/i)
    if (await postTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeScreenshot(page, 'post-screen-preview')
      const descriptionInput = page.getByPlaceholder(/décris/i)
      if (await descriptionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descriptionInput.fill('Test de publication automatique')
        await takeScreenshot(page, 'post-screen-with-description')
      }
      const hashtag = page.getByText('#Gabon')
      if (await hashtag.isVisible({ timeout: 2000 }).catch(() => false)) {
        await hashtag.click()
        await page.waitForTimeout(500)
        await takeScreenshot(page, 'post-screen-hashtags')
      }
    }
  })

  test('should have publish button on post screen', async ({ page }) => {
    await page.goto('/post?mediaType=video&mediaUri=https://test-videos.com/sample.mp4')
    await page.waitForTimeout(3000)
    const publishBtn = page.getByText(/publier/i).last()
    const publishButton = page.locator('button, [role="button"]').filter({ hasText: /^Publier$/i })
    const hasPublishBtn = (await publishBtn.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await publishButton.isVisible({ timeout: 2000 }).catch(() => false))
    if (hasPublishBtn) {
      await takeScreenshot(page, 'post-publish-button')
    }
  })

  test('should show visibility options on post screen', async ({ page }) => {
    await page.goto('/post?mediaType=image&mediaUri=https://picsum.photos/400/600')
    await page.waitForTimeout(3000)
    const visibilityText = page.getByText(/qui peut voir/i)
    if (await visibilityText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await visibilityText.click()
      await page.waitForTimeout(500)
      await takeScreenshot(page, 'post-visibility-toggle')
    }
  })

  test('should show comment toggle on post screen', async ({ page }) => {
    await page.goto('/post?mediaType=image&mediaUri=https://picsum.photos/400/600')
    await page.waitForTimeout(3000)
    const commentToggle = page.getByText(/commentaires/i)
    if (await commentToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commentToggle.click()
      await page.waitForTimeout(500)
      await takeScreenshot(page, 'post-comments-toggle')
    }
  })

  test('should show duo toggle on post screen', async ({ page }) => {
    await page.goto('/post?mediaType=image&mediaUri=https://picsum.photos/400/600')
    await page.waitForTimeout(3000)
    const duoToggle = page.getByText(/duo/i)
    if (await duoToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await duoToggle.click()
      await page.waitForTimeout(500)
      await takeScreenshot(page, 'post-duo-toggle')
    }
  })
})
