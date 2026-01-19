/**
 * x402 Payment Protocol Library
 *
 * Unified exports for x402 payment protocol implementation
 */

// Configuration
export * from './config'

// Client (for making payments)
export * from './client'

// Server (for accepting payments)
export * from './server'

// Payment Schemes (exact, upto, subscription, batch)
export * from './schemes'

// MCP Client (for AI agent integration)
export {
  createX402MCPClient,
  type X402MCPClientConfig,
  type X402MCPClient,
} from './mcp-client'

// Bazaar Sync (for facilitator discovery)
export * from './bazaar-sync'
