import { cn } from '@/lib/utils'

interface StatCardProps {
    label: string
    value: string | number
    subtext?: string
    trend?: {
        value: string
        direction: 'up' | 'down' | 'neutral'
    }
    sparkline?: number[]
    icon?: React.ReactNode
    className?: string
}

export function StatCard({
    label,
    value,
    subtext,
    trend,
    sparkline,
    icon,
    className,
}: StatCardProps) {
    return (
        <div
            className={cn(
                'group p-5 bg-card border border-border rounded-xl transition-all duration-300',
                'hover:bg-muted/60 hover:border-border/80 hover:shadow-lg hover:shadow-primary/5',
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                </span>
                {icon && (
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {icon}
                    </span>
                )}
            </div>

            {/* Value */}
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-2xl font-mono font-bold text-foreground mb-1">
                        {value}
                    </div>
                    {subtext && (
                        <div className="text-xs text-muted-foreground">{subtext}</div>
                    )}
                    {trend && (
                        <div
                            className={cn(
                                'text-xs font-mono mt-1',
                                trend.direction === 'up' && 'text-green-400',
                                trend.direction === 'down' && 'text-red-400',
                                trend.direction === 'neutral' && 'text-muted-foreground'
                            )}
                        >
                            {trend.direction === 'up' && '↑'}
                            {trend.direction === 'down' && '↓'}
                            {trend.direction === 'neutral' && '→'}
                            {' '}{trend.value}
                        </div>
                    )}
                </div>

                {/* Sparkline */}
                {sparkline && sparkline.length > 0 && (
                    <div className="flex items-end gap-0.5 h-8">
                        {sparkline.map((val, i) => {
                            const max = Math.max(...sparkline)
                            const height = max > 0 ? (val / max) * 100 : 0
                            return (
                                <div
                                    key={i}
                                    className="w-1 bg-blue-500/40 rounded-sm transition-all group-hover:bg-blue-500/60"
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                />
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

// Grid wrapper for consistent stat card layouts
interface StatGridProps {
    children: React.ReactNode
    columns?: 2 | 3 | 4
    className?: string
}

export function StatGrid({ children, columns = 4, className }: StatGridProps) {
    return (
        <div
            className={cn(
                'grid gap-4',
                columns === 2 && 'grid-cols-1 md:grid-cols-2',
                columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
                className
            )}
        >
            {children}
        </div>
    )
}
