'use client'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ShieldCheck, ShieldQuestion, Award, Crown } from 'lucide-react'

/**
 * Verification tier configuration
 */
const VERIFICATION_TIERS = {
  UNVERIFIED: {
    label: 'Unverified',
    description: 'Endpoint has not been tested',
    icon: ShieldQuestion,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
  },
  TESTED: {
    label: 'Tested',
    description: '100+ successful calls tracked',
    icon: ShieldCheck,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  VERIFIED: {
    label: 'Verified',
    description: 'Manual review + 1000+ calls',
    icon: ShieldCheck,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    borderColor: 'border-gray-400/30',
  },
  TRUSTED: {
    label: 'Trusted',
    description: 'Attestation + 10,000+ calls',
    icon: Award,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  CERTIFIED: {
    label: 'Certified',
    description: 'On-chain reputation + audit',
    icon: Crown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
} as const

type VerificationTier = keyof typeof VERIFICATION_TIERS

/**
 * Get score color based on trust score value
 */
function getScoreColor(score: number): string {
  if (score >= 800) return 'text-emerald-500'
  if (score >= 600) return 'text-green-500'
  if (score >= 400) return 'text-yellow-500'
  if (score >= 200) return 'text-orange-500'
  return 'text-red-500'
}

/**
 * Get score background color
 */
function getScoreBgColor(score: number): string {
  if (score >= 800) return 'bg-emerald-500/10'
  if (score >= 600) return 'bg-green-500/10'
  if (score >= 400) return 'bg-yellow-500/10'
  if (score >= 200) return 'bg-orange-500/10'
  return 'bg-red-500/10'
}

/**
 * Get score label
 */
function getScoreLabel(score: number): string {
  if (score >= 800) return 'Excellent'
  if (score >= 600) return 'Good'
  if (score >= 400) return 'Fair'
  if (score >= 200) return 'Poor'
  return 'Very Poor'
}

interface TrustScoreBadgeProps {
  score: number
  tier?: VerificationTier
  showScore?: boolean
  showTier?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Trust Score Badge Component
 *
 * Displays an endpoint's trust score and verification tier with visual indicators.
 * Includes tooltips with detailed information.
 */
export function TrustScoreBadge({
  score,
  tier = 'UNVERIFIED',
  showScore = true,
  showTier = true,
  size = 'md',
  className,
}: TrustScoreBadgeProps) {
  const tierConfig = VERIFICATION_TIERS[tier]
  const TierIcon = tierConfig.icon
  const scoreColor = getScoreColor(score)
  const scoreBgColor = getScoreBgColor(score)
  const scoreLabel = getScoreLabel(score)

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  }

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1.5', className)}>
        {/* Trust Score */}
        {showScore && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'inline-flex items-center rounded-md border font-mono font-semibold',
                  scoreBgColor,
                  scoreColor,
                  sizeClasses[size]
                )}
              >
                {score}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <div className="space-y-1">
                <p className="font-semibold">{scoreLabel} Trust Score</p>
                <p className="text-xs text-muted-foreground">
                  {score}/1000 - Based on performance, reliability, economic factors,
                  and provider reputation.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Verification Tier Badge */}
        {showTier && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border',
                  tierConfig.bgColor,
                  tierConfig.borderColor,
                  tierConfig.color,
                  sizeClasses[size]
                )}
              >
                <TierIcon size={iconSizes[size]} />
                <span className="font-medium">{tierConfig.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <div className="space-y-1">
                <p className="font-semibold">{tierConfig.label}</p>
                <p className="text-xs text-muted-foreground">
                  {tierConfig.description}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

interface TrustScoreBarProps {
  score: number
  showLabel?: boolean
  className?: string
}

/**
 * Trust Score Progress Bar
 *
 * Visual representation of trust score as a progress bar.
 */
export function TrustScoreBar({
  score,
  showLabel = true,
  className,
}: TrustScoreBarProps) {
  const percentage = (score / 1000) * 100
  const scoreColor = getScoreColor(score)
  const scoreLabel = getScoreLabel(score)

  // Calculate gradient color stops based on score thresholds
  const getGradientColor = () => {
    if (score >= 800) return 'from-emerald-500 to-emerald-400'
    if (score >= 600) return 'from-green-500 to-green-400'
    if (score >= 400) return 'from-yellow-500 to-yellow-400'
    if (score >= 200) return 'from-orange-500 to-orange-400'
    return 'from-red-500 to-red-400'
  }

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Trust Score</span>
          <span className={cn('font-medium', scoreColor)}>
            {score}/1000 ({scoreLabel})
          </span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full bg-linear-to-r transition-all duration-500',
            getGradientColor()
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface TrustMetricsCardProps {
  metrics: {
    successRate: number
    avgResponseTime: number
    totalCalls: number
    consistencyScore?: number
  }
  className?: string
}

/**
 * Trust Metrics Card
 *
 * Displays detailed trust metrics in a card format.
 */
export function TrustMetricsCard({ metrics, className }: TrustMetricsCardProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 rounded-lg border bg-card p-4',
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Success Rate</p>
        <p className="text-lg font-semibold tabular-nums">
          {metrics.successRate.toFixed(1)}%
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Avg Latency</p>
        <p className="text-lg font-semibold tabular-nums">
          {metrics.avgResponseTime}ms
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Total Calls</p>
        <p className="text-lg font-semibold tabular-nums">
          {metrics.totalCalls.toLocaleString()}
        </p>
      </div>
      {metrics.consistencyScore !== undefined && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Consistency</p>
          <p className="text-lg font-semibold tabular-nums">
            {metrics.consistencyScore.toFixed(0)}%
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Re-export for convenience
 */
export { VERIFICATION_TIERS, type VerificationTier }
