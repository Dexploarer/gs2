/**
 * Library Tests: Validation Utilities
 *
 * Tests input validation, address validation, and data sanitization
 */
import { describe, it, expect } from 'vitest'

// Validation utility functions (matching project patterns)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ETHEREUM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

function isValidSolanaAddress(address: string): boolean {
  return SOLANA_ADDRESS_REGEX.test(address)
}

function isValidEthereumAddress(address: string): boolean {
  return ETHEREUM_ADDRESS_REGEX.test(address)
}

function isValidTransactionSignature(signature: string): boolean {
  // Solana transaction signatures are base58 encoded, typically 87-88 chars
  return /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(signature)
}

function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

function isValidGhostScore(score: number): boolean {
  return typeof score === 'number' && score >= 0 && score <= 1000 && Number.isFinite(score)
}

function isValidTier(tier: string): boolean {
  return ['bronze', 'silver', 'gold', 'platinum'].includes(tier)
}

function calculateTierFromScore(score: number): string {
  if (score >= 900) return 'platinum'
  if (score >= 750) return 'gold'
  if (score >= 600) return 'silver'
  return 'bronze'
}

function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && Number.isFinite(amount)
}

function isValidTimestamp(timestamp: number): boolean {
  const now = Date.now()
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
  const oneYearFuture = now + 365 * 24 * 60 * 60 * 1000
  return timestamp > oneYearAgo && timestamp < oneYearFuture
}

describe('Address Validation', () => {
  describe('isValidSolanaAddress', () => {
    it('accepts valid Solana addresses', () => {
      expect(isValidSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(true)
      expect(isValidSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true)
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true)
    })

    it('rejects invalid Solana addresses', () => {
      expect(isValidSolanaAddress('')).toBe(false)
      expect(isValidSolanaAddress('too-short')).toBe(false)
      expect(isValidSolanaAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f')).toBe(false) // Ethereum address
      expect(isValidSolanaAddress('contains_invalid_0O1l_chars')).toBe(false) // Has 0, O, I, l
    })

    it('rejects addresses with invalid characters', () => {
      expect(isValidSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs!')).toBe(false)
      expect(isValidSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs ')).toBe(false)
    })
  })

  describe('isValidEthereumAddress', () => {
    it('accepts valid Ethereum addresses', () => {
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f4A23b')).toBe(true)
      expect(isValidEthereumAddress('0x0000000000000000000000000000000000000000')).toBe(true)
    })

    it('rejects invalid Ethereum addresses', () => {
      expect(isValidEthereumAddress('')).toBe(false)
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f')).toBe(false) // Too short
      expect(isValidEthereumAddress('742d35Cc6634C0532925a3b844Bc9e7595f4A23b')).toBe(false) // Missing 0x
      expect(isValidEthereumAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(false) // Solana
    })
  })
})

describe('Transaction Signature Validation', () => {
  describe('isValidTransactionSignature', () => {
    it('accepts valid transaction signatures', () => {
      expect(
        isValidTransactionSignature(
          '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d9GQSNE9QR6TJk6bYr7YPkLs2N5tZHLy9xQKnHkdvAj'
        )
      ).toBe(true)
    })

    it('rejects invalid signatures', () => {
      expect(isValidTransactionSignature('')).toBe(false)
      expect(isValidTransactionSignature('too-short')).toBe(false)
      expect(isValidTransactionSignature('contains invalid chars!')).toBe(false)
    })
  })
})

describe('Input Sanitization', () => {
  describe('sanitizeInput', () => {
    it('trims whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello')
      expect(sanitizeInput('\n\thello\n\t')).toBe('hello')
    })

    it('removes angle brackets', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script')
      expect(sanitizeInput('hello<world>')).toBe('helloworld')
    })

    it('handles empty strings', () => {
      expect(sanitizeInput('')).toBe('')
      expect(sanitizeInput('   ')).toBe('')
    })

    it('preserves normal text', () => {
      expect(sanitizeInput('Hello World')).toBe('Hello World')
      expect(sanitizeInput('agent@example.com')).toBe('agent@example.com')
    })
  })
})

describe('Ghost Score Validation', () => {
  describe('isValidGhostScore', () => {
    it('accepts valid scores', () => {
      expect(isValidGhostScore(0)).toBe(true)
      expect(isValidGhostScore(500)).toBe(true)
      expect(isValidGhostScore(1000)).toBe(true)
      expect(isValidGhostScore(750.5)).toBe(true)
    })

    it('rejects invalid scores', () => {
      expect(isValidGhostScore(-1)).toBe(false)
      expect(isValidGhostScore(1001)).toBe(false)
      expect(isValidGhostScore(NaN)).toBe(false)
      expect(isValidGhostScore(Infinity)).toBe(false)
    })

    it('rejects non-numeric values', () => {
      // @ts-expect-error - Testing invalid input
      expect(isValidGhostScore('500')).toBe(false)
      // @ts-expect-error - Testing invalid input
      expect(isValidGhostScore(null)).toBe(false)
    })
  })
})

describe('Tier Validation', () => {
  describe('isValidTier', () => {
    it('accepts valid tiers', () => {
      expect(isValidTier('bronze')).toBe(true)
      expect(isValidTier('silver')).toBe(true)
      expect(isValidTier('gold')).toBe(true)
      expect(isValidTier('platinum')).toBe(true)
    })

    it('rejects invalid tiers', () => {
      expect(isValidTier('diamond')).toBe(false)
      expect(isValidTier('GOLD')).toBe(false) // Case sensitive
      expect(isValidTier('')).toBe(false)
    })
  })

  describe('calculateTierFromScore', () => {
    it('returns platinum for scores >= 900', () => {
      expect(calculateTierFromScore(900)).toBe('platinum')
      expect(calculateTierFromScore(950)).toBe('platinum')
      expect(calculateTierFromScore(1000)).toBe('platinum')
    })

    it('returns gold for scores 750-899', () => {
      expect(calculateTierFromScore(750)).toBe('gold')
      expect(calculateTierFromScore(800)).toBe('gold')
      expect(calculateTierFromScore(899)).toBe('gold')
    })

    it('returns silver for scores 600-749', () => {
      expect(calculateTierFromScore(600)).toBe('silver')
      expect(calculateTierFromScore(650)).toBe('silver')
      expect(calculateTierFromScore(749)).toBe('silver')
    })

    it('returns bronze for scores < 600', () => {
      expect(calculateTierFromScore(0)).toBe('bronze')
      expect(calculateTierFromScore(300)).toBe('bronze')
      expect(calculateTierFromScore(599)).toBe('bronze')
    })
  })
})

describe('Amount Validation', () => {
  describe('isValidAmount', () => {
    it('accepts valid amounts', () => {
      expect(isValidAmount(0.01)).toBe(true)
      expect(isValidAmount(100)).toBe(true)
      expect(isValidAmount(0.0001)).toBe(true)
    })

    it('rejects invalid amounts', () => {
      expect(isValidAmount(0)).toBe(false)
      expect(isValidAmount(-1)).toBe(false)
      expect(isValidAmount(NaN)).toBe(false)
      expect(isValidAmount(Infinity)).toBe(false)
    })
  })
})

describe('Timestamp Validation', () => {
  describe('isValidTimestamp', () => {
    it('accepts recent timestamps', () => {
      expect(isValidTimestamp(Date.now())).toBe(true)
      expect(isValidTimestamp(Date.now() - 1000)).toBe(true)
      expect(isValidTimestamp(Date.now() + 60000)).toBe(true) // 1 minute in future
    })

    it('rejects timestamps too far in the past', () => {
      const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000
      expect(isValidTimestamp(twoYearsAgo)).toBe(false)
    })

    it('rejects timestamps too far in the future', () => {
      const twoYearsAhead = Date.now() + 2 * 365 * 24 * 60 * 60 * 1000
      expect(isValidTimestamp(twoYearsAhead)).toBe(false)
    })

    it('rejects invalid values', () => {
      expect(isValidTimestamp(0)).toBe(false)
      expect(isValidTimestamp(-1)).toBe(false)
    })
  })
})

describe('Combined Validation', () => {
  it('validates complete agent data', () => {
    const agent = {
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      ghostScore: 750,
      tier: 'gold',
      createdAt: Date.now(),
    }

    expect(isValidSolanaAddress(agent.address)).toBe(true)
    expect(isValidGhostScore(agent.ghostScore)).toBe(true)
    expect(isValidTier(agent.tier)).toBe(true)
    expect(isValidTimestamp(agent.createdAt)).toBe(true)
  })

  it('validates complete transaction data', () => {
    const transaction = {
      signature: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d9GQSNE9QR6TJk6bYr7YPkLs2N5tZHLy9xQKnHkdvAj',
      amount: 0.05,
      timestamp: Date.now(),
    }

    expect(isValidTransactionSignature(transaction.signature)).toBe(true)
    expect(isValidAmount(transaction.amount)).toBe(true)
    expect(isValidTimestamp(transaction.timestamp)).toBe(true)
  })
})
