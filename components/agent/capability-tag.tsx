'use client'

import { Badge } from '@/components/ui/badge'

interface CapabilityTagProps {
  capability: string
  level: 'basic' | 'intermediate' | 'advanced' | 'expert'
  isVerified: boolean
  successRate?: number
  onClick?: () => void
}

/**
 * Display agent capability with proficiency level and verification status
 */
export function CapabilityTag({
  capability,
  level,
  isVerified,
  successRate,
  onClick,
}: CapabilityTagProps) {
  const levelConfig = {
    basic: { label: '⚪', color: 'text-gray-500' },
    intermediate: { label: '🟢', color: 'text-green-500' },
    advanced: { label: '🔵', color: 'text-blue-500' },
    expert: { label: '🟣', color: 'text-purple-500' },
  }

  const config = levelConfig[level]

  // Format capability name for display (e.g., "code-review" → "Code Review")
  const displayName = capability
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <Badge
      variant={isVerified ? 'default' : 'outline'}
      className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
      title={`${displayName} - ${level}${successRate ? ` (${successRate.toFixed(1)}% success)` : ''}`}
    >
      <span className={`mr-1 ${config.color}`}>{config.label}</span>
      {displayName}
      {isVerified && <span className="ml-1">✓</span>}
    </Badge>
  )
}
