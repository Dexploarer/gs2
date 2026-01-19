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

  const { wallets, selectedWallet, selectedAccount, connected, connecting, select, disconnect } =
    useConnector()
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
  if (connected && selectedAccount && selectedWallet) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className={cn('gap-2', className)}>
            {selectedWallet.icon && (
              <img
                src={selectedWallet.icon}
                alt={selectedWallet.name}
                className="h-4 w-4 rounded-sm"
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
            onClick={() => disconnect()}
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
            {wallets.length === 0 ? (
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
              wallets.map((w) => (
                <Button
                  key={w.wallet.name}
                  variant="outline"
                  className="w-full justify-start gap-3 h-14"
                  onClick={async () => {
                    await select(w.wallet.name)
                    setIsModalOpen(false)
                  }}
                >
                  {w.wallet.icon && (
                    <img
                      src={w.wallet.icon}
                      alt={w.wallet.name}
                      className="h-8 w-8 rounded-lg"
                    />
                  )}
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{w.wallet.name}</span>
                    <span className="text-xs text-muted-foreground">Detected</span>
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
  const { connected, selectedWallet } = useConnector()
  const { formatted } = useAccount()

  if (!connected) {
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
      {selectedWallet?.icon && (
        <img src={selectedWallet.icon} alt={selectedWallet.name} className="h-4 w-4 rounded-sm" />
      )}
      <span className="text-sm font-mono">{formatted}</span>
    </div>
  )
}
