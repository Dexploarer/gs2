// E2E test setup for GhostSpeak v2
// This file runs before each test file

import { test as base } from '@playwright/test'

// Extend the base test with common fixtures
export const test = base.extend({
  // Add custom fixtures here as needed
  // Example:
  // authenticatedPage: async ({ page }, use) => {
  //   // Setup authenticated session
  //   await use(page)
  // }
})

// Export expect for convenience
export { expect } from '@playwright/test'