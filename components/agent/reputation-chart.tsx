'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts'
import { cn } from '@/lib/utils'

interface ReputationChartProps {
  agentId: Id<'agents'>
  className?: string
  days?: number
  showTierLines?: boolean
  compact?: boolean
}

// Tier thresholds
const TIER_THRESHOLDS = {
  silver: 500,
  gold: 750,
  platinum: 900,
}

// Tier colors
const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

/**
 * Visual chart of reputation score over time
 * Uses Recharts to display Ghost Score history with tier reference lines
 */
export function ReputationChart({
  agentId,
  className,
  days = 30,
  showTierLines = true,
  compact = false,
}: ReputationChartProps) {
  const history = useQuery(api.scoreHistory.getForAgent, { agentId, days })

  // Loading state
  if (history === undefined) {
    return (
      <div
        className={cn(
          'bg-muted/30 rounded-lg flex items-center justify-center animate-pulse',
          compact ? 'h-24' : 'h-48',
          className
        )}
      >
        <div className="text-sm text-muted-foreground">Loading chart...</div>
      </div>
    )
  }

  // No data state
  if (history.length === 0) {
    return (
      <div
        className={cn(
          'bg-muted/30 rounded-lg flex items-center justify-center',
          compact ? 'h-24' : 'h-48',
          className
        )}
      >
        <div className="text-sm text-muted-foreground">No score history available</div>
      </div>
    )
  }

  // Format data for chart
  const chartData = history.map((point) => ({
    ...point,
    date: new Date(point.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: new Date(point.timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  }))

  // Calculate min/max for Y axis
  const scores = history.map((h) => h.score)
  const minScore = Math.max(0, Math.min(...scores) - 50)
  const maxScore = Math.min(1000, Math.max(...scores) + 50)

  // Calculate score change
  const firstScore = history[0]?.score ?? 0
  const lastScore = history[history.length - 1]?.score ?? 0
  const scoreChange = lastScore - firstScore
  const isPositive = scoreChange >= 0

  // Determine gradient color based on trend
  const gradientColor = isPositive ? '#22c55e' : '#ef4444'

  return (
    <div className={cn('w-full', compact ? 'h-24' : 'h-48', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={compact ? { top: 5, right: 5, left: -20, bottom: 0 } : { top: 10, right: 10, left: -10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {!compact && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--muted-foreground))"
              opacity={0.2}
              vertical={false}
            />
          )}

          <XAxis
            dataKey="date"
            tick={{ fontSize: compact ? 10 : 12, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval={compact ? 'preserveStartEnd' : Math.ceil(chartData.length / 6)}
          />

          {!compact && (
            <YAxis
              domain={[minScore, maxScore]}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toString()}
            />
          )}

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const data = payload[0].payload
              return (
                <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                  <p className="text-sm font-medium text-popover-foreground">{data.fullDate}</p>
                  <p className="text-lg font-bold text-primary">{Math.round(data.score)} pts</p>
                  {data.tier && (
                    <p className="text-xs text-muted-foreground capitalize">{data.tier} Tier</p>
                  )}
                </div>
              )
            }}
          />

          {/* Tier reference lines */}
          {showTierLines && !compact && (
            <>
              <ReferenceLine
                y={TIER_THRESHOLDS.silver}
                stroke={TIER_COLORS.silver}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <ReferenceLine
                y={TIER_THRESHOLDS.gold}
                stroke={TIER_COLORS.gold}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <ReferenceLine
                y={TIER_THRESHOLDS.platinum}
                stroke={TIER_COLORS.platinum}
                strokeDasharray="3 3"
                opacity={0.5}
              />
            </>
          )}

          {/* Area fill */}
          <Area
            type="monotone"
            dataKey="score"
            stroke="transparent"
            fill="url(#scoreGradient)"
          />

          {/* Main line */}
          <Line
            type="monotone"
            dataKey="score"
            stroke={gradientColor}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: gradientColor,
              stroke: 'hsl(var(--background))',
              strokeWidth: 2,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Mini sparkline version for compact displays
 */
export function ReputationSparkline({ agentId, className }: { agentId: Id<'agents'>; className?: string }) {
  return <ReputationChart agentId={agentId} className={className} days={7} showTierLines={false} compact />
}
