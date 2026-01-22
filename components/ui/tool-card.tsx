import { cn } from '@/lib/utils'
import Link from 'next/link'

interface ToolCardProps {
    name: string
    description: string
    address?: string
    href?: string
    cost?: string
    status?: 'active' | 'inactive' | 'pending'
    badge?: string
    onClick?: () => void
    className?: string
}

export function ToolCard({
    name,
    description,
    address,
    href,
    cost,
    status = 'active',
    badge,
    onClick,
    className,
}: ToolCardProps) {
    const content = (
        <>
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono text-foreground text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">
                        {name}
                    </h3>
                    <div className="flex items-center gap-2">
                        {badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                                {badge}
                            </span>
                        )}
                        {status === 'active' && (
                            <div className="status-pulse w-1.5 h-1.5" />
                        )}
                        {status === 'pending' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                        )}
                        {status === 'inactive' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-border" />
                        )}
                    </div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    {description}
                </p>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between text-xs font-mono">
                {address && (
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address}
                    </span>
                )}
                {!address && <span />}
                {cost && (
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                        {cost}
                    </span>
                )}
                {href && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                        ↗
                    </span>
                )}
            </div>
        </>
    )

    const cardClasses = cn(
        'tool-card group p-5 bg-card border border-border rounded-xl',
        'hover:bg-muted/60 transition-all duration-300 flex flex-col justify-between h-full',
        className
    )

    if (href) {
        const isExternal = href.startsWith('http')
        if (isExternal) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClasses}
                >
                    {content}
                </a>
            )
        }
        return (
            <Link href={href} className={cardClasses}>
                {content}
            </Link>
        )
    }

    if (onClick) {
        return (
            <button onClick={onClick} className={cn(cardClasses, 'text-left')}>
                {content}
            </button>
        )
    }

    return <div className={cardClasses}>{content}</div>
}

// Grid wrapper for tool cards
interface ToolGridProps {
    children: React.ReactNode
    columns?: 2 | 3
    className?: string
}

export function ToolGrid({ children, columns = 3, className }: ToolGridProps) {
    return (
        <div
            className={cn(
                'grid gap-4',
                columns === 2 && 'grid-cols-1 md:grid-cols-2',
                columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                className
            )}
        >
            {children}
        </div>
    )
}
