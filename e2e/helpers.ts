import { Page } from '@playwright/test'
import path from 'path'

export const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots')

export async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)
}

export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  })
}

export async function loginIfNeeded(page: Page, email: string, password: string) {
  const loginBtn = page.getByText('Se connecter')
  if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const emailInput = page.getByPlaceholder(/email|Email|e-mail/i)
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(email)
      await page.getByPlaceholder(/mot de passe|password/i).fill(password)
      await loginBtn.click()
      await page.waitForTimeout(3000)
    }
  }
}

export async function navigateToTab(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: new RegExp(label, 'i') })
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click()
    await page.waitForTimeout(1500)
  }
}
