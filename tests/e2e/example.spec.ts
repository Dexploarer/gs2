import { test, expect } from '@playwright/test'

test.describe('GhostSpeak v2 E2E Tests', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/GhostSpeak/)
  })

  test('should navigate to observatory', async ({ page }) => {
    await page.goto('/')
    // Add navigation tests once routes are defined
  })
})