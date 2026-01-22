'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/agents', label: 'Agents' },
  { href: '/observatory', label: 'Observatory' },
  { href: '/docs', label: 'Docs' },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-border bg-background/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-mono font-semibold text-foreground group-hover:text-primary transition-colors">
              GHOSTSPEAK
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm transition-colors relative',
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
                {pathname === item.href && (
                  <span className="absolute -bottom-[17px] left-0 right-0 h-px bg-primary" />
                )}
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
