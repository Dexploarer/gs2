'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import Link from 'next/link'

// Helper to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export default function ObservatoryPage() {
  // Fetch real data from Convex
  const agentStats = useQuery(api.agentProfiles.getStats, {})
  const paymentStats = useQuery(api.x402Payments.getStats, {})
  const reputationStats = useQuery(api.reputationScores.getStats, {})
  const topAgents = useQuery(api.reputationScores.getTopAgents, { limit: 5 })
  const recentActivity = useQuery(api.agentActivity.getRecentActivity, { limit: 10 })
  const solanaMetrics = useQuery(api.systemMetrics.getNetworkMetrics, { network: 'solana' })
  const baseMetrics = useQuery(api.systemMetrics.getNetworkMetrics, { network: 'base' })

  // Loading state
  if (
    agentStats === undefined ||
    paymentStats === undefined ||
    reputationStats === undefined ||
    topAgents === undefined ||
    recentActivity === undefined ||
    solanaMetrics === undefined ||
    baseMetrics === undefined
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading Observatory...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Observatory</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of AI agent commerce, x402 payments, and trust metrics
        </p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{agentStats.totalAgents.toLocaleString()}</div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              {agentStats.activeAgents.toLocaleString()} active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>x402 Transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {paymentStats.total >= 1_000_000
                ? `${(paymentStats.total / 1_000_000).toFixed(1)}M`
                : paymentStats.total.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ${paymentStats.totalVolume >= 1_000_000
                ? `${(paymentStats.totalVolume / 1_000_000).toFixed(1)}M`
                : paymentStats.totalVolume.toLocaleString()}{' '}
              volume
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Ghost Score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{reputationStats.avgOverallScore}</div>
            <div className="text-sm text-muted-foreground mt-1">Network average</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Activity Feed */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Live Activity Feed</CardTitle>
                  <CardDescription>Real-time agent actions across the network</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">LIVE</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity
                  </div>
                ) : (
                  recentActivity.map((activity) => (
                    <div
                      key={activity._id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm truncate">
                            {activity.agent?.name || 'Unknown Agent'}
                          </span>
                          {activity.agent && (
                            <GhostScoreBadge
                              score={activity.agent.ghostScore}
                              tier={activity.agent.tier as 'bronze' | 'silver' | 'gold' | 'platinum'}
                              showScore={false}
                              className="flex-shrink-0"
                            />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {activity.activityType === 'payment' &&
                            `Completed x402 payment${activity.metadata?.amount ? `: $${activity.metadata.amount.toFixed(2)}` : ''}`}
                          {activity.activityType === 'endpoint_call' &&
                            `API call to ${activity.metadata?.endpoint || 'endpoint'}`}
                          {activity.activityType === 'credential_issued' &&
                            `Received Verifiable Credential${activity.metadata?.credentialType ? `: ${activity.metadata.credentialType}` : ''}`}
                          {activity.activityType === 'score_change' &&
                            `Ghost Score changed: ${activity.metadata?.oldScore || 0} → ${activity.metadata?.newScore || 0}`}
                          {activity.activityType === 'tier_change' &&
                            `Tier upgraded${activity.metadata?.newTier ? ` to ${activity.metadata.newTier}` : ''}`}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatRelativeTime(activity.timestamp)}</span>
                          {activity.metadata?.scoreImpact && activity.metadata.scoreImpact > 0 && (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              +{activity.metadata.scoreImpact} score
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Network Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Solana Network</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Finality</span>
                  <span className="text-lg font-bold">{solanaMetrics.finality}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">TPS</span>
                  <span className="text-lg font-bold">
                    {solanaMetrics.tps.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Uptime</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {solanaMetrics.uptime}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Base Network</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Finality</span>
                  <span className="text-lg font-bold">{baseMetrics.finality}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">TPS</span>
                  <span className="text-lg font-bold">
                    {baseMetrics.tps.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Uptime</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {baseMetrics.uptime}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar - Top Agents */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Agents</CardTitle>
              <CardDescription>Highest Ghost Scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topAgents.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No agents yet
                  </div>
                ) : (
                  topAgents.map((rep, index) => (
                    <div
                      key={rep._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {rep.agent?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Score: {rep.overallScore}
                        </div>
                      </div>
                      {rep.agent && (
                        <GhostScoreBadge
                          score={rep.agent.ghostScore}
                          tier={rep.agent.tier as 'bronze' | 'silver' | 'gold' | 'platinum'}
                          showScore={false}
                          className="flex-shrink-0"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/observatory/agents"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Agent Directory
              </Link>
              <Link
                href="/observatory/payments"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Payment Analytics
              </Link>
              <Link
                href="/observatory/facilitators"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Facilitator Registry
              </Link>
              <Link
                href="/observatory/merchants"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Merchants & Services
              </Link>
              <Link
                href="/observatory/endpoints"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Endpoint Explorer
              </Link>
              <Link
                href="/observatory/reputation"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Reputation Timeline
              </Link>
              <Link
                href="/observatory/health"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → System Health
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
