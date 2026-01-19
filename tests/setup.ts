/**
 * Vitest Test Setup
 *
 * 2026 Best Practices:
 * - Proper environment variable handling with fallbacks
 * - Skip integration tests when external services unavailable
 * - Mock external dependencies for unit tests
 */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Check if we have real Convex credentials for integration tests
 * Format: https://<deployment-name>.convex.cloud
 */
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL

export const hasConvexCredentials = Boolean(
  CONVEX_URL &&
    CONVEX_URL.includes('.convex.cloud') &&
    !CONVEX_URL.includes('test.convex.cloud')
)

/**
 * Check if we have real Solana RPC access
 */
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL

export const hasSolanaAccess = Boolean(
  SOLANA_RPC && (SOLANA_RPC.includes('solana.com') || SOLANA_RPC.includes('helius'))
)

// ============================================================================
// Mock Environment Variables (for unit tests)
// ============================================================================

// Only set mock values if real values aren't present
if (!CONVEX_URL) {
  process.env.NEXT_PUBLIC_CONVEX_URL = 'https://mock-deployment.convex.cloud'
}

if (!SOLANA_RPC) {
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL = 'https://api.devnet.solana.com'
}

process.env.NEXT_PUBLIC_SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet'

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Skip test if Convex is not configured
 * Usage: it.skipIf(!hasConvexCredentials)('should...', () => {})
 */
export const skipWithoutConvex = !hasConvexCredentials

/**
 * Skip test if Solana RPC is not configured
 */
export const skipWithoutSolana = !hasSolanaAccess

// ============================================================================
// Global Test Hooks
// ============================================================================

// Suppress console warnings in tests unless DEBUG is set
if (!process.env.DEBUG) {
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    // Filter out known noisy warnings
    const message = args[0]
    if (
      typeof message === 'string' &&
      (message.includes('React does not recognize') ||
        message.includes('Warning: validateDOMNesting'))
    ) {
      return
    }
    originalWarn.apply(console, args)
  }
}

// ============================================================================
// Mock Fetch for Unit Tests
// ============================================================================

// Store original fetch
const originalFetch = global.fetch

// Mock fetch for tests that don't need real network access
export function mockFetch(mockResponse: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockResponse),
    text: () => Promise.resolve(JSON.stringify(mockResponse)),
  })
}

// Restore original fetch
export function restoreFetch() {
  global.fetch = originalFetch
}
