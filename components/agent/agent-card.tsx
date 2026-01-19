'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import { CredentialBadge } from './credential-badge'
import { CapabilityTag } from './capability-tag'
import Link from 'next/link'
import type { Id } from '@/convex/_generated/dataModel'

interface AgentCardProps {
  agent: {
    _id: Id<'agents'>
    name: string
    address: string
    ghostScore: number
    tier: 'bronze' | 'silver' | 'gold' | 'platinum'
    isActive: boolean
  }
  profile?: {
    avgResponseTime?: number
    totalRequests?: number
    uptime?: number
    totalEarningsUSDC?: number
    errorRate?: number
  }
  reputation?: {
    overallScore: number
    trustScore: number
    qualityScore: number
    reliabilityScore: number
    economicScore: number
    socialScore: number
    trend: 'rising' | 'falling' | 'stable'
  }
  credentials?: Array<{
    _id: Id<'credentials'>
    credentialType: string
    issuedAt: number
    isRevoked: boolean
  }>
  capabilities?: Array<{
    capability: string
    level: 'basic' | 'intermediate' | 'advanced' | 'expert'
    isVerified: boolean
    successRate: number
  }>
  variant?: 'default' | 'compact' | 'detailed'
  onClick?: () => void
}

/**
 * Enhanced Agent Card with reputation data, credentials, and capabilities
 *
 * Variants:
 * - default: Standard card with key metrics
 * - compact: Minimal card for lists
 * - detailed: Full card with all data
 */
export function AgentCard({
  agent,
  profile,
  reputation,
  credentials = [],
  capabilities = [],
  variant = 'default',
  onClick,
}: AgentCardProps) {
  const activeCredentials = credentials.filter(c => !c.isRevoked).slice(0, 3)
  const topCapabilities = capabilities
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3)

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm truncate">{agent.name}</span>
            {!agent.isActive && (
              <Badge variant="outline" className="text-xs">Inactive</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{agent.address}</p>
        </div>
        <GhostScoreBadge
          score={agent.ghostScore}
          tier={agent.tier}
          showScore={true}
          className="flex-shrink-0"
        />
      </div>
    )
  }

  return (
    <Card
      onClick={onClick}
      className={onClick ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-xl truncate">{agent.name}</CardTitle>
              {!agent.isActive && (
                <Badge variant="outline" className="text-xs">Inactive</Badge>
              )}
              {reputation?.trend === 'rising' && (
                <Badge variant="default" className="text-xs bg-green-600">
                  ↗ Rising
                </Badge>
              )}
            </div>
            <CardDescription className="truncate">{agent.address}</CardDescription>
          </div>
          <GhostScoreBadge
            score={agent.ghostScore}
            tier={agent.tier}
            showScore={true}
            className="flex-shrink-0"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Reputation Scores */}
        {reputation && variant === 'detailed' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Reputation</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trust</span>
                <span className="font-medium">{reputation.trustScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quality</span>
                <span className="font-medium">{reputation.qualityScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reliability</span>
                <span className="font-medium">{reputation.reliabilityScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Economic</span>
                <span className="font-medium">{reputation.economicScore}/100</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {profile && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {profile.avgResponseTime !== undefined && (
              <div>
                <div className="text-muted-foreground text-xs">Avg Response</div>
                <div className="font-medium">{profile.avgResponseTime}ms</div>
              </div>
            )}
            {profile.uptime !== undefined && (
              <div>
                <div className="text-muted-foreground text-xs">Uptime</div>
                <div className="font-medium text-green-600 dark:text-green-400">
                  {profile.uptime.toFixed(1)}%
                </div>
              </div>
            )}
            {profile.totalRequests !== undefined && (
              <div>
                <div className="text-muted-foreground text-xs">Total Requests</div>
                <div className="font-medium">{profile.totalRequests.toLocaleString()}</div>
              </div>
            )}
            {profile.totalEarningsUSDC !== undefined && (
              <div>
                <div className="text-muted-foreground text-xs">Earnings</div>
                <div className="font-medium">${profile.totalEarningsUSDC.toLocaleString()}</div>
              </div>
            )}
          </div>
        )}

        {/* Credentials */}
        {activeCredentials.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Credentials</div>
            <div className="flex flex-wrap gap-2">
              {activeCredentials.map((credential) => (
                <CredentialBadge
                  key={credential._id}
                  type={credential.credentialType}
                  issuedAt={credential.issuedAt}
                />
              ))}
              {credentials.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{credentials.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Capabilities */}
        {topCapabilities.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Capabilities</div>
            <div className="flex flex-wrap gap-2">
              {topCapabilities.map((cap, index) => (
                <CapabilityTag
                  key={index}
                  capability={cap.capability}
                  level={cap.level}
                  isVerified={cap.isVerified}
                  successRate={cap.successRate}
                />
              ))}
              {capabilities.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{capabilities.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* View Details Link */}
        <Link
          href={`/observatory/agents/${agent.address}`}
          className="block w-full text-center py-2 text-sm text-primary hover:text-primary/80 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View Full Profile →
        </Link>
      </CardContent>
    </Card>
  )
}
