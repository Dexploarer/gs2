'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface FacilitatorComparisonProps {
  compact?: boolean
}

/**
 * Facilitator comparison component - now fetches real data from Convex
 */
export function FacilitatorComparison({ compact = false }: FacilitatorComparisonProps) {
  // Fetch facilitators from Convex
  const facilitators = useQuery(api.facilitators.list, {
    limit: compact ? 3 : 20,
  })

  // Loading state
  if (facilitators === undefined) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-4 w-64 bg-muted rounded mt-2" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="space-y-2">
                    <div className="h-4 w-16 bg-muted rounded" />
                    <div className="h-6 w-20 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Empty state
  if (facilitators.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No facilitators registered yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Run the seed function to populate facilitator data.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Format pricing for display
  const formatPricing = (pricing: { model: string; feePercentage?: number; flatFee?: number }) => {
    if (pricing.model === 'free') return 'Free'
    if (pricing.model === 'percentage' && pricing.feePercentage) {
      return `${(pricing.feePercentage * 100).toFixed(1)}% fee`
    }
    if (pricing.model === 'fee-per-transaction' && pricing.flatFee) {
      return `$${pricing.flatFee.toFixed(4)}/tx`
    }
    return pricing.model
  }

  return (
    <div className="space-y-4">
      {facilitators.map((facilitator) => (
        <Card key={facilitator._id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-lg">{facilitator.name}</CardTitle>
                  {facilitator.isVerified && (
                    <Badge variant="default" className="text-xs">
                      Verified
                    </Badge>
                  )}
                  <Badge
                    variant={
                      facilitator.status === 'active'
                        ? 'default'
                        : facilitator.status === 'beta'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="text-xs"
                  >
                    {facilitator.status}
                  </Badge>
                </div>
                <CardDescription>{facilitator.description}</CardDescription>
              </div>
              {facilitator.performance.dailyVolume > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ${(facilitator.performance.dailyVolume / 1000).toFixed(0)}K
                  </div>
                  <div className="text-xs text-muted-foreground">Daily Volume</div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Performance Metrics */}
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Uptime</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {facilitator.performance.uptime}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Response Time</div>
                  <div
                    className={`text-lg font-bold ${
                      facilitator.performance.avgResponseTime < 150
                        ? 'text-green-600 dark:text-green-400'
                        : facilitator.performance.avgResponseTime < 300
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-orange-600 dark:text-orange-400'
                    }`}
                  >
                    {facilitator.performance.avgResponseTime}ms
                  </div>
                </div>
              </div>

              {/* Volume Metrics */}
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Daily Transactions</div>
                  <div className="text-lg font-bold">
                    {facilitator.performance.dailyTransactions >= 1000
                      ? `${(facilitator.performance.dailyTransactions / 1000).toFixed(0)}K`
                      : facilitator.performance.dailyTransactions.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Supported Tokens</div>
                  <div className="text-sm font-medium">
                    {facilitator.supportedTokens.slice(0, 3).join(', ')}
                    {facilitator.supportedTokens.length > 3 &&
                      ` +${facilitator.supportedTokens.length - 3}`}
                  </div>
                </div>
              </div>

              {/* Networks */}
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Primary Network</div>
                  <Badge variant="outline">{facilitator.networks[0]}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">All Networks</div>
                  <div className="text-sm font-medium">{facilitator.networks.length} chains</div>
                </div>
              </div>

              {/* Pricing & Features */}
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Pricing</div>
                  <div className="text-lg font-bold">{formatPricing(facilitator.pricing)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Features</div>
                  <div className="flex flex-wrap gap-1">
                    {facilitator.features.slice(0, 2).map((feature, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {facilitator.features.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{facilitator.features.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with links */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                {facilitator.documentationUrl && (
                  <a
                    href={facilitator.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Docs
                  </a>
                )}
                {facilitator.githubUrl && (
                  <a
                    href={facilitator.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    GitHub
                  </a>
                )}
                {facilitator.twitterHandle && (
                  <a
                    href={`https://twitter.com/${facilitator.twitterHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    @{facilitator.twitterHandle}
                  </a>
                )}
              </div>
              <a
                href={facilitator.facilitatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Visit {facilitator.name}
              </a>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
