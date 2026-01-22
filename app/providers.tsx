'use client'

import { ThemeProvider } from 'next-themes'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { WalletProvider } from '@/components/wallet/provider'
import { SolanaConnectionProvider } from '@/hooks'
import * as React from 'react'

const noopWatch = {
  onUpdate: () => () => {},
  localQueryResult: () => undefined,
  localQueryLogs: () => undefined,
  journal: () => undefined,
}

const noopPaginatedWatch = {
  onUpdate: () => () => {},
  localQueryResult: () => undefined,
}

const noopConvexClient = {
  watchQuery: () => noopWatch,
  watchPaginatedQuery: () => noopPaginatedWatch,
  mutation: async () => {
    throw new Error('Convex client not configured')
  },
  action: async () => {
    throw new Error('Convex client not configured')
  },
} as unknown as ConvexReactClient

function getConvexClient() {
  if (typeof window === 'undefined') {
    return noopConvexClient
  }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) {
    console.warn('NEXT_PUBLIC_CONVEX_URL not set')
    return noopConvexClient
  }
  return new ConvexReactClient(url)
}

const convex = getConvexClient()

/**
 * Root Providers Component
 *
 * Provider hierarchy (2026):
 * 1. ThemeProvider (dark/light mode)
 * 2. WalletProvider (Solana wallet via ConnectorKit)
 * 3. SolanaConnectionProvider (shared RPC connection)
 * 4. ConvexProvider (Convex backend)
 */
export function Providers(props: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <WalletProvider>
        <SolanaConnectionProvider>
          <ConvexProvider client={convex}>
            {props.children}
          </ConvexProvider>
        </SolanaConnectionProvider>
      </WalletProvider>
    </ThemeProvider>
  )
}
