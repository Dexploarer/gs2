'use client'

import { useMemo } from 'react'
import { AppProvider } from '@solana/connector/react'
import { getDefaultConfig, getDefaultMobileConfig } from '@solana/connector/headless'

interface WalletProviderProps {
  children: React.ReactNode
}

/**
 * Solana Wallet Provider (ConnectorKit)
 *
 * Provides wallet connection context using @solana/connector
 * Supports all Wallet Standard compliant wallets (Phantom, Solflare, etc.)
 */
export function WalletProvider({ children }: WalletProviderProps) {
  const connectorConfig = useMemo(() => {
    // Get custom RPC URL from environment
    const customRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet'

    // Configure clusters with custom RPC if provided
    const clusters = customRpcUrl
      ? [
          {
            id: 'solana:mainnet' as const,
            label: 'Mainnet',
            name: 'mainnet-beta' as const,
            url: cluster === 'mainnet-beta' ? customRpcUrl : 'https://api.mainnet-beta.solana.com',
          },
          {
            id: 'solana:devnet' as const,
            label: 'Devnet',
            name: 'devnet' as const,
            url: cluster === 'devnet' ? customRpcUrl : 'https://api.devnet.solana.com',
          },
          {
            id: 'solana:testnet' as const,
            label: 'Testnet',
            name: 'testnet' as const,
            url: 'https://api.testnet.solana.com',
          },
        ]
      : undefined

    return getDefaultConfig({
      appName: 'GhostSpeak',
      appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://ghostspeak.xyz',
      autoConnect: true,
      enableMobile: true,
      network: cluster === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
      clusters,
      debug: process.env.NODE_ENV === 'development',
    })
  }, [])

  const mobileConfig = useMemo(
    () =>
      getDefaultMobileConfig({
        appName: 'GhostSpeak',
        appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://ghostspeak.xyz',
      }),
    []
  )

  return (
    <AppProvider connectorConfig={connectorConfig} mobile={mobileConfig}>
      {children}
    </AppProvider>
  )
}
