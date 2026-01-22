'use client'

import { useState } from 'react'
import { useConnector, useAccount } from '@solana/connector'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { Check, Copy, LogOut, Wallet, ChevronDown, Loader2 } from 'lucide-react'

interface ConnectWalletButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Wallet Connect Button
 *
 * Uses @solana/connector (ConnectorKit) for Wallet Standard support
 * Supports all major Solana wallets: Phantom, Solflare, Backpack, etc.
 */
export function ConnectWalletButton({
  className,
  variant = 'default',
  size = 'default',
}: ConnectWalletButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  // Use the new vNext API (2026) - connectWallet/connectors instead of deprecated select/wallets
  const {
    connectors,           // New: WalletConnectorMetadata[] with stable IDs
    connector,            // New: Currently connected connector metadata
    connectWallet,        // New: Connect using connector ID
    disconnectWallet,     // New: New disconnect method
    isConnected,          // New: Boolean helper
    isConnecting,         // New: Boolean helper
    account,              // New: Selected account address
  } = useConnector()

  // Map to legacy names for minimal changes
  const connected = isConnected
  const connecting = isConnecting
  const selectedWallet = connector
  const { formatted, copy } = useAccount()

  // Handle copy address
  const handleCopy = async () => {
    await copy()
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  // Loading state
  if (connecting) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    )
  }

  // Connected state - show dropdown menu
  if (connected && account && selectedWallet) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className={cn('gap-2', className)}>
            {selectedWallet.icon && (
              <Image
                src={selectedWallet.icon}
                alt={selectedWallet.name}
                width={16}
                height={16}
                className="h-4 w-4 rounded-sm"
                unoptimized
              />
            )}
            <span className="font-mono">{formatted}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
            {copiedAddress ? (
              <Check className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copiedAddress ? 'Copied!' : 'Copy Address'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => disconnectWallet()}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Disconnected state - show connect button
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn('gap-2', className)}
        onClick={() => setIsModalOpen(true)}
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>

      {/* Wallet Selection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogDescription>
              Select a wallet to connect to GhostSpeak. We support all Wallet Standard compatible
              wallets.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            {connectors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No wallets detected</p>
                <p className="text-sm mt-2">
                  Install a Solana wallet like{' '}
                  <a
                    href="https://phantom.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Phantom
                  </a>{' '}
                  or{' '}
                  <a
                    href="https://solflare.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Solflare
                  </a>
                </p>
              </div>
            ) : (
              connectors.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-start gap-3 h-14"
                  disabled={!c.ready}
                  onClick={async () => {
                    try {
                      // Use the new connectWallet API with connector ID (2026 fix)
                      await connectWallet(c.id)
                      setIsModalOpen(false)
                    } catch (error) {
                      console.error('Wallet connection failed:', error)
                      // If the error is "Unexpected error", it's likely a Phantom internal issue
                      // Recommend refreshing or checking wallet state
                      alert(
                        `Failed to connect to ${c.name}. Please ensure your wallet is unlocked and try again. If the issue persists, try refreshing the page.`
                      )
                    }
                  }}
                >
                  {c.icon && (
                    <Image
                      src={c.icon}
                      alt={c.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-lg"
                      unoptimized
                    />
                  )}
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Minimal wallet status indicator
 * Shows just the connection status without dropdown
 */
export function WalletStatus({ className }: { className?: string }) {
  // Use the new vNext API (2026)
  const { isConnected, connector } = useConnector()
  const { formatted } = useAccount()

  if (!isConnected) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="text-sm">Not connected</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 w-2 rounded-full bg-green-500" />
      {connector?.icon && (
        <Image
          src={connector.icon}
          alt={connector.name}
          width={16}
          height={16}
          className="h-4 w-4 rounded-sm"
          unoptimized
        />
      )}
      <span className="text-sm font-mono">{formatted}</span>
    </div>
  )
}
