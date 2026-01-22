'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import { cn } from '@/lib/utils'

interface AppNavigationProps {
    moduleName?: string
    badge?: 'BETA' | 'NEW' | 'LIVE'
}

// Map routes to module names and badges
const routeConfig: Record<string, { module: string; badge?: 'BETA' | 'NEW' | 'LIVE' }> = {
    '/dashboard': { module: 'Dashboard' },
    '/agents': { module: 'Agents' },
    '/observatory': { module: 'Observatory', badge: 'LIVE' },
    '/staking': { module: 'Staking' },
    '/database': { module: 'Database', badge: 'BETA' },
}

// Sub-navigation items for different modules
const moduleNavItems: Record<string, { href: string; label: string }[]> = {
    observatory: [
        { href: '/observatory', label: 'Overview' },
        { href: '/observatory/facilitators', label: 'Facilitators' },
        { href: '/observatory/payments', label: 'Payments' },
        { href: '/observatory/endpoints', label: 'Endpoints' },
        { href: '/observatory/agents', label: 'Agents' },
    ],
    agents: [
        { href: '/agents', label: 'Discovery' },
    ],
    staking: [
        { href: '/staking', label: 'Overview' },
    ],
}

export function AppNavigation({
    moduleName: moduleOverride,
    badge: badgeOverride,
}: AppNavigationProps = {}) {
    const pathname = usePathname()

    // Find matching route config
    const matchingRoute = Object.entries(routeConfig).find(([route]) =>
        pathname.startsWith(route)
    )

    const moduleName = moduleOverride ?? matchingRoute?.[1].module
    const badge = badgeOverride ?? matchingRoute?.[1].badge

    // Determine current module from pathname
    const currentModule = pathname.split('/')[1] || 'home'
    const subNavItems = moduleNavItems[currentModule] || []

    return (
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
            {/* Main Navigation */}
            <nav className="border-b border-border">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex h-14 items-center justify-between">
                        {/* Left: Breadcrumb Branding */}
                        <div className="flex items-center gap-3">
                            <Link href="/" className="font-mono font-bold text-foreground text-sm tracking-tight hover:text-primary transition-colors">
                                GHOSTSPEAK
                            </Link>
                            {moduleName && (
                                <>
                                    <span className="text-muted-foreground text-sm">/</span>
                                    <span className="font-mono text-muted-foreground text-sm">{moduleName}</span>
                                    {badge && (
                                        <span className={cn(
                                            'px-1.5 py-0.5 text-[10px] font-mono rounded',
                                            badge === 'BETA' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                                            badge === 'NEW' && 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
                                            badge === 'LIVE' && 'bg-green-500/10 text-green-400 border border-green-500/20'
                                        )}>
                                            {badge}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Center: Quick Links */}
                        <div className="hidden md:flex items-center gap-6">
                            <Link href="/dashboard" className={cn(
                                'text-sm transition-colors',
                                pathname === '/dashboard' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}>
                                Dashboard
                            </Link>
                            <Link href="/agents" className={cn(
                                'text-sm transition-colors',
                                pathname.startsWith('/agents') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}>
                                Agents
                            </Link>
                            <Link href="/observatory" className={cn(
                                'text-sm transition-colors',
                                pathname.startsWith('/observatory') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}>
                                Observatory
                            </Link>
                            <Link href="/staking" className={cn(
                                'text-sm transition-colors',
                                pathname.startsWith('/staking') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}>
                                Staking
                            </Link>
                        </div>

                        {/* Right: Utility Bar */}
                        <div className="flex items-center gap-4">
                            {/* Search Hint */}
                            <button className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted border border-border rounded-lg hover:border-border/70 transition-colors">
                                <span>Search...</span>
                                <kbd className="px-1.5 py-0.5 bg-subtle rounded text-[10px] font-mono">⌘K</kbd>
                            </button>

                            {/* GitHub */}
                            <a
                                href="https://github.com/ghostspeak/ghostspeak"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="GitHub"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                            </a>

                            {/* Wallet */}
                            <ConnectWalletButton />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Sub Navigation (if applicable) */}
            {subNavItems.length > 0 && (
                <div className="bg-muted">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="flex items-center gap-6 h-10">
                            {subNavItems.map((item) => {
                                const isActive = pathname === item.href
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'relative text-sm transition-colors py-2',
                                            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {item.label}
                                        {isActive && (
                                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </header>
    )
}
