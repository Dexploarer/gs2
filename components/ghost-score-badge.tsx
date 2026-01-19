'use client'

import { Badge } from './ui/badge'

interface GhostScoreBadgeProps {
  score: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  showScore?: boolean
  className?: string
}

/**
 * Display Ghost Score with tier badge
 */
export function GhostScoreBadge({
  score,
  tier,
  showScore = true,
  className,
}: GhostScoreBadgeProps) {
  return (
    <div className={className}>
      <Badge variant={tier} className="text-sm">
        {tier.toUpperCase()}
        {showScore && ` • ${score}`}
      </Badge>
    </div>
  )
}
