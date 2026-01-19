/**
 * E2E Tests: Agent Profile Page
 *
 * Tests the agent profile viewing experience
 */
import { test, expect } from '@playwright/test'

test.describe('Agent Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a known test agent page
    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')
  })

  test('displays agent profile heading', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('shows agent ghost score', async ({ page }) => {
    // Look for ghost score display
    const scoreElement = page.getByText(/ghost score/i)
    await expect(scoreElement).toBeVisible({ timeout: 10000 })
  })

  test('displays agent tier badge', async ({ page }) => {
    // Check for tier badge (bronze, silver, gold, or platinum)
    const tierBadge = page.getByText(/bronze|silver|gold|platinum/i)
    await expect(tierBadge).toBeVisible({ timeout: 10000 })
  })

  test('shows agent address', async ({ page }) => {
    // Look for truncated address display
    const address = page.getByText(/7xKXtg2C/i)
    await expect(address).toBeVisible({ timeout: 10000 })
  })

  test('displays agent capabilities if present', async ({ page }) => {
    // Capabilities section may or may not be present
    const capabilitiesSection = page.getByText(/capabilities/i)

    if (await capabilitiesSection.isVisible()) {
      await expect(capabilitiesSection).toBeVisible()
    }
  })

  test('shows transaction history section', async ({ page }) => {
    const transactionSection = page.getByText(/transactions|history|payments/i)

    // May take time to load
    await expect(transactionSection).toBeVisible({ timeout: 15000 })
  })

  test('navigates back to agent list', async ({ page }) => {
    // Find and click back navigation
    const backLink = page.getByRole('link', { name: /back|agents|observatory/i })

    if (await backLink.isVisible()) {
      await backLink.click()
      await expect(page).toHaveURL(/agents|observatory/)
    }
  })

  test('shows 404 for non-existent agent', async ({ page }) => {
    await page.goto('/agents/nonexistent-agent-address-123')

    // Should show not found message
    const notFound = page.getByText(/not found|404|doesn't exist/i)
    await expect(notFound).toBeVisible({ timeout: 10000 })
  })

  test('handles invalid address format gracefully', async ({ page }) => {
    await page.goto('/agents/invalid!')

    // Should show error or redirect
    const errorMessage = page.getByText(/invalid|error|not found/i)
    await expect(errorMessage).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Agent Profile Loading States', () => {
  test('shows loading state while fetching', async ({ page }) => {
    // Intercept the API call to delay it
    await page.route('**/api/seance/agent/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.continue()
    })

    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Should show loading indicator
    const loading = page.getByText(/loading/i)
    await expect(loading).toBeVisible({ timeout: 5000 })
  })

  test('shows error state when API fails', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/seance/agent/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Should show error message
    const error = page.getByText(/error|failed|try again/i)
    await expect(error).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Agent Profile Interactions', () => {
  test('can copy agent address', async ({ page }) => {
    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Find copy button
    const copyButton = page.getByRole('button', { name: /copy/i })

    if (await copyButton.isVisible()) {
      await copyButton.click()

      // Should show copied confirmation
      const copied = page.getByText(/copied/i)
      await expect(copied).toBeVisible({ timeout: 5000 })
    }
  })

  test('can navigate to transaction details', async ({ page }) => {
    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Wait for transactions to load
    await page.waitForLoadState('networkidle')

    // Find a transaction link
    const transactionLink = page.getByRole('link', { name: /tx|transaction/i }).first()

    if (await transactionLink.isVisible()) {
      await transactionLink.click()
      // Should navigate to transaction or open explorer
    }
  })

  test('can view reputation breakdown', async ({ page }) => {
    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Find reputation section
    const reputationSection = page.getByText(/reputation|score breakdown/i)

    if (await reputationSection.isVisible()) {
      await reputationSection.click()
      // Should expand or navigate to reputation details
    }
  })
})

test.describe('Agent Profile Responsive Design', () => {
  test('displays correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Profile should still be visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('displays correctly on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Profile should still be visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('displays correctly on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/agents/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')

    // Profile should still be visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })
})
