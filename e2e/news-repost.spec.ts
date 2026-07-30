import { test, expect, type Page } from '@playwright/test'
import {
  waitForApp,
  navigateToTab,
  takeScreenshot,
} from './helpers'

const REPOST_LABEL = /reposter la publication|retirer le repost/i

async function openActus(page: Page) {
  await page.goto('/')
  await waitForApp(page)

  await navigateToTab(page, 'Actus')

  const actus = page.getByText(/^Actus$/i).first()
  if (await actus.isVisible({ timeout: 3000 }).catch(() => false)) {
    await actus.click()
  }

  await page.waitForTimeout(3000)
}

async function getRepostButton(page: Page) {
  const button = page.getByRole('button', {
    name: REPOST_LABEL,
  }).first()

  await expect(button).toBeVisible({ timeout: 8000 })
  return button
}

test.describe('Actus: repost', () => {
  test('reposte une publication', async ({ page }) => {
    await openActus(page)

    const button = await getRepostButton(page)
    await button.click()

    await expect(
      page.getByRole('button', {
        name: /retirer le repost/i,
      }).first(),
    ).toBeVisible({ timeout: 5000 })

    await takeScreenshot(page, 'news-repost-created')
  })

  test('retire un repost', async ({ page }) => {
    await openActus(page)

    const button = await getRepostButton(page)
    const label = await button.getAttribute('aria-label')

    if (!/retirer le repost/i.test(label ?? '')) {
      await button.click()
      await page.waitForTimeout(1000)
    }

    await page.getByRole('button', {
      name: /retirer le repost/i,
    }).first().click()

    await expect(
      page.getByRole('button', {
        name: /reposter la publication/i,
      }).first(),
    ).toBeVisible({ timeout: 5000 })

    await takeScreenshot(page, 'news-repost-removed')
  })

  test('deux utilisateurs peuvent reposter le même post', async ({
    browser,
  }) => {
    test.skip(
      !process.env.E2E_USER_EMAIL ||
      !process.env.E2E_USER_PASSWORD ||
      !process.env.E2E_USER_2_EMAIL ||
      !process.env.E2E_USER_2_PASSWORD,
      'Deux comptes E2E sont nécessaires',
    )

    const firstContext = await browser.newContext()
    const secondContext = await browser.newContext()
    const firstPage = await firstContext.newPage()
    const secondPage = await secondContext.newPage()

    await openActus(firstPage)
    await openActus(secondPage)

    const firstButton = await getRepostButton(firstPage)
    const secondButton = await getRepostButton(secondPage)

    await firstButton.click()
    await secondButton.click()

    await expect(
      firstPage.getByText(/2 reposts?|2 repost/i).first(),
    ).toBeVisible({ timeout: 5000 })

    await expect(
      secondPage.getByText(/2 reposts?|2 repost/i).first(),
    ).toBeVisible({ timeout: 5000 })

    await firstContext.close()
    await secondContext.close()
  })

  test('conserve l\'état précédent après une erreur réseau', async ({
    page,
  }) => {
    await openActus(page)

    const button = await getRepostButton(page)
    const before = await button.getAttribute('aria-label')

    await page.route('**/*', async (route) => {
      const request = route.request()
      const url = request.url()

      if (
        url.includes('googleapis.com') ||
        url.includes('firestore')
      ) {
        await route.abort('failed')
        return
      }

      await route.continue()
    })

    await button.click()
    await page.waitForTimeout(2500)

    const after = await button.getAttribute('aria-label')
    expect(after).toBe(before)

    await page.unroute('**/*')
    await takeScreenshot(page, 'news-repost-rollback')
  })
})
