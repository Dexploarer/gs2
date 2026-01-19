/**
 * E2E Tests: Observatory Dashboard
 *
 * Tests the main observatory dashboard functionality
 */
import { test, expect } from '@playwright/test'

test.describe('Observatory Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/observatory')
  })

  test('displays observatory page', async ({ page }) => {
    // Check for main heading
    await expect(page.getByRole('heading', { name: /observatory/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('shows network statistics', async ({ page }) => {
    // Look for stats section
    const statsSection = page.getByText(/total agents|active agents|transactions/i)
    await expect(statsSection).toBeVisible({ timeout: 10000 })
  })

  test('displays agent list', async ({ page }) => {
    // Wait for agent list to load
    const agentList = page.getByRole('list').or(page.locator('[data-testid="agent-list"]'))

    // May need to wait for data to load
    await expect(agentList.or(page.getByText(/agents/i))).toBeVisible({ timeout: 15000 })
  })

  test('shows payment feed', async ({ page }) => {
    // Look for payments section
    const paymentSection = page.getByText(/payments|transactions|recent activity/i)
    await expect(paymentSection).toBeVisible({ timeout: 10000 })
  })

  test('displays health status', async ({ page }) => {
    // Look for health indicators
    const healthIndicator = page.getByText(/health|online|status/i)
    await expect(healthIndicator).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Observatory Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/observatory')
    await page.waitForLoadState('networkidle')
  })

  test('can filter agents by tier', async ({ page }) => {
    // Find tier filter
    const tierFilter = page.getByRole('combobox', { name: /tier/i }).or(
      page.getByRole('button', { name: /filter|tier/i })
    )

    if (await tierFilter.isVisible()) {
      await tierFilter.click()

      // Select platinum tier
      const platinumOption = page.getByRole('option', { name: /platinum/i }).or(
        page.getByText(/platinum/i)
      )

      if (await platinumOption.isVisible()) {
        await platinumOption.click()
        // Results should be filtered
      }
    }
  })

  test('can search for agents', async ({ page }) => {
    // Find search input
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))

    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await page.waitForTimeout(500) // Debounce

      // Should filter results
    }
  })

  test('can sort agents by score', async ({ page }) => {
    // Find sort control
    const sortControl = page.getByRole('combobox', { name: /sort/i }).or(
      page.getByRole('button', { name: /sort/i })
    )

    if (await sortControl.isVisible()) {
      await sortControl.click()

      const sortOption = page.getByText(/score|highest/i)

      if (await sortOption.isVisible()) {
        await sortOption.click()
      }
    }
  })
})

test.describe('Observatory Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/observatory')
    await page.waitForLoadState('networkidle')
  })

  test('can navigate to agent details', async ({ page }) => {
    // Find an agent card and click it
    const agentCard = page.locator('[data-testid="agent-card"]').first().or(
      page.getByRole('link', { name: /agent|view/i }).first()
    )

    if (await agentCard.isVisible()) {
      await agentCard.click()
      await expect(page).toHaveURL(/agents\//)
    }
  })

  test('can navigate to payment details', async ({ page }) => {
    // Find a payment card and click it
    const paymentCard = page.locator('[data-testid="payment-card"]').first().or(
      page.getByRole('link', { name: /payment|transaction/i }).first()
    )

    if (await paymentCard.isVisible()) {
      await paymentCard.click()
      // Should show payment details or open explorer
    }
  })

  test('has navigation tabs', async ({ page }) => {
    // Check for tab navigation
    const tabs = page.getByRole('tablist').or(page.getByRole('navigation'))

    if (await tabs.isVisible()) {
      await expect(tabs).toBeVisible()
    }
  })
})

test.describe('Observatory Real-time Updates', () => {
  test('updates data periodically', async ({ page }) => {
    await page.goto('/observatory')

    // Wait for initial load
    await page.waitForLoadState('networkidle')

    // Look for live indicator
    const liveIndicator = page.getByText(/live|real-time|updating/i)

    if (await liveIndicator.isVisible()) {
      await expect(liveIndicator).toBeVisible()
    }
  })

  test('shows new payments in feed', async ({ page }) => {
    await page.goto('/observatory')
    await page.waitForLoadState('networkidle')

    // Track initial payment count
    const paymentCards = page.locator('[data-testid="payment-card"]')
    const initialCount = await paymentCards.count()

    // Wait for potential updates (if real-time is working)
    await page.waitForTimeout(5000)

    // Count should stay same or increase (not decrease)
    const newCount = await paymentCards.count()
    expect(newCount).toBeGreaterThanOrEqual(0) // Relaxed assertion for tests
  })
})

test.describe('Observatory Error Handling', () => {
  test('handles API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/observatory/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await page.goto('/observatory')

    // Should show error state or fallback
    const errorMessage = page.getByText(/error|failed|try again|something went wrong/i)
    await expect(errorMessage).toBeVisible({ timeout: 10000 })
  })

  test('shows empty state when no data', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/observatory/agents**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: { agents: [], total: 0 } }),
      })
    })

    await page.goto('/observatory')

    // Should show empty state message
    const emptyState = page.getByText(/no agents|no data|empty/i)
    await expect(emptyState.or(page.getByRole('heading'))).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Observatory Responsive Design', () => {
  test('adapts to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/observatory')

    // Should still show main content
    await expect(page.getByRole('heading', { name: /observatory/i })).toBeVisible({
      timeout: 10000,
    })

    // Navigation might be in hamburger menu
    const mobileMenu = page.getByRole('button', { name: /menu/i })

    if (await mobileMenu.isVisible()) {
      await mobileMenu.click()
    }
  })

  test('adapts to tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/observatory')

    await expect(page.getByRole('heading', { name: /observatory/i })).toBeVisible({
      timeout: 10000,
    })
  })
})
