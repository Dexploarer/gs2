/**
 * x402 Payment Protocol Configuration
 *
 * Centralizes all x402 configuration including facilitators,
 * network settings, and token addresses.
 */

export const X402_NETWORKS = {
  SOLANA_MAINNET: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  SOLANA_DEVNET: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  BASE_MAINNET: 'eip155:8453',
  BASE_SEPOLIA: 'eip155:84532',
} as const

export const USDC_ADDRESSES = {
  // Solana Mainnet USDC
  SOLANA_MAINNET: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  // Solana Devnet USDC
  SOLANA_DEVNET: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  // Base Mainnet USDC
  BASE_MAINNET: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  // Base Sepolia USDC
  BASE_SEPOLIA: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const

export const FACILITATORS = {
  PAYAI: {
    name: 'PayAI',
    url: 'https://facilitator.payai.network',
    networks: [
      X402_NETWORKS.SOLANA_MAINNET,
      X402_NETWORKS.SOLANA_DEVNET,
      X402_NETWORKS.BASE_MAINNET,
    ],
    features: ['gasless', 'multi-chain', 'free'],
  },
  COINBASE_CDP: {
    name: 'Coinbase CDP',
    url: 'https://api.cdp.coinbase.com/platform/v2/x402',
    networks: [
      X402_NETWORKS.SOLANA_MAINNET,
      X402_NETWORKS.SOLANA_DEVNET,
      X402_NETWORKS.BASE_MAINNET,
    ],
    features: ['fee-free-usdc', 'enterprise'],
    requiresAuth: true, // CDP API key required
  },
  RAPID402: {
    name: 'Rapid402',
    url: 'https://facilitator.rapid402.com',
    networks: [X402_NETWORKS.SOLANA_MAINNET, X402_NETWORKS.SOLANA_DEVNET],
    features: ['typescript-sdk', 'developer-first'],
  },
  OPENX402: {
    name: 'OpenX402.ai',
    url: 'https://facilitator.openx402.ai',
    networks: [
      X402_NETWORKS.SOLANA_MAINNET,
      X402_NETWORKS.SOLANA_DEVNET,
      X402_NETWORKS.BASE_MAINNET,
    ],
    features: ['permissionless', 'gasless', 'omnichain'],
  },
} as const

export type FacilitatorKey = keyof typeof FACILITATORS

export interface X402Config {
  facilitator: FacilitatorKey
  network: (typeof X402_NETWORKS)[keyof typeof X402_NETWORKS]
  environment: 'mainnet' | 'devnet' | 'testnet'
}

export const getDefaultConfig = (environment: 'mainnet' | 'devnet' = 'devnet'): X402Config => ({
  facilitator: 'PAYAI',
  network:
    environment === 'mainnet' ? X402_NETWORKS.SOLANA_MAINNET : X402_NETWORKS.SOLANA_DEVNET,
  environment,
})

export const getFacilitatorUrl = (facilitator: FacilitatorKey): string => {
  return FACILITATORS[facilitator].url
}

export const getUSDCAddress = (
  network: (typeof X402_NETWORKS)[keyof typeof X402_NETWORKS]
): string => {
  if (network === X402_NETWORKS.SOLANA_MAINNET) return USDC_ADDRESSES.SOLANA_MAINNET
  if (network === X402_NETWORKS.SOLANA_DEVNET) return USDC_ADDRESSES.SOLANA_DEVNET
  if (network === X402_NETWORKS.BASE_MAINNET) return USDC_ADDRESSES.BASE_MAINNET
  if (network === X402_NETWORKS.BASE_SEPOLIA) return USDC_ADDRESSES.BASE_SEPOLIA
  throw new Error(`Unknown network: ${network}`)
}

export const isSolanaNetwork = (
  network: (typeof X402_NETWORKS)[keyof typeof X402_NETWORKS]
): boolean => {
  return network === X402_NETWORKS.SOLANA_MAINNET || network === X402_NETWORKS.SOLANA_DEVNET
}

export const isBaseNetwork = (
  network: (typeof X402_NETWORKS)[keyof typeof X402_NETWORKS]
): boolean => {
  return network === X402_NETWORKS.BASE_MAINNET || network === X402_NETWORKS.BASE_SEPOLIA
}
