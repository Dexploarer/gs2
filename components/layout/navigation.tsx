'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/staking', label: 'Staking' },
  { href: '/agents', label: 'Agents' },
  { href: '/observatory', label: 'Observatory' },
  { href: '/database', label: 'Database' },
  { href: '/docs', label: 'Docs' },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-xl">👻</span>
            </div>
            <span className="font-bold text-xl tracking-tight">GhostSpeak</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Wallet Connect */}
          <ConnectWalletButton />
        </div>
      </div>
    </nav>
  )
}
