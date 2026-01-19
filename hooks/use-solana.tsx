'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Connection, type Commitment } from '@solana/web3.js'

// RPC URL from environment
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const DEFAULT_COMMITMENT: Commitment = 'confirmed'

/**
 * Solana connection context type
 */
export interface SolanaConnectionContextType {
  connection: Connection
  rpcUrl: string
  commitment: Commitment
}

/**
 * Solana connection context
 * Provides a shared Connection instance to avoid recreating connections
 */
const SolanaConnectionContext = createContext<SolanaConnectionContextType | null>(null)

/**
 * Props for the Solana connection provider
 */
interface SolanaConnectionProviderProps {
  children: ReactNode
  rpcUrl?: string
  commitment?: Commitment
}

/**
 * Provider component for Solana connection
 * Wrap your app with this to share a single Connection instance
 */
export function SolanaConnectionProvider({
  children,
  rpcUrl = RPC_URL,
  commitment = DEFAULT_COMMITMENT,
}: SolanaConnectionProviderProps): ReactNode {
  const value = useMemo<SolanaConnectionContextType>(
    () => ({
      connection: new Connection(rpcUrl, commitment),
      rpcUrl,
      commitment,
    }),
    [rpcUrl, commitment]
  )

  return (
    <SolanaConnectionContext.Provider value={value}>
      {children}
    </SolanaConnectionContext.Provider>
  )
}

/**
 * Hook to access the shared Solana connection
 * Falls back to creating a local connection if used outside provider
 */
export function useSolanaConnection(): SolanaConnectionContextType {
  const context = useContext(SolanaConnectionContext)

  // Create fallback connection if not in provider context
  const fallback = useMemo<SolanaConnectionContextType>(
    () => ({
      connection: new Connection(RPC_URL, DEFAULT_COMMITMENT),
      rpcUrl: RPC_URL,
      commitment: DEFAULT_COMMITMENT,
    }),
    []
  )

  return context ?? fallback
}

/**
 * Hook to get just the connection (convenience wrapper)
 */
export function useConnection(): Connection {
  const { connection } = useSolanaConnection()
  return connection
}
