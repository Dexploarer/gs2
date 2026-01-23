'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { ToolCard, ToolGrid } from '@/components/ui/tool-card'

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
        <div className="text-muted-foreground font-mono text-sm">LOADING OBSERVATORY...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold text-foreground mb-2">
          Observatory
        </h1>
        <p className="text-muted-foreground">
          Real-time monitoring of AI agent commerce and trust metrics
        </p>
      </div>

      {/* Top Stats Grid */}
      <StatGrid columns={3}>
        <StatCard
          label="Total Agents"
          value={agentStats.totalAgents.toLocaleString()}
          subtext={`${agentStats.activeAgents.toLocaleString()} active`}
          trend={{ value: 'Network Growth', direction: 'up' }}
        />
        <StatCard
          label="x402 Volume"
          value={paymentStats.totalVolume >= 1_000_000
            ? `$${(paymentStats.totalVolume / 1_000_000).toFixed(1)}M`
            : `$${paymentStats.totalVolume.toLocaleString()}`}
          subtext={`${paymentStats.total.toLocaleString()} txs`}
          trend={{ value: '24h Volume', direction: 'neutral' }}
        />
        <StatCard
          label="Avg Ghost Score"
          value={reputationStats.avgOverallScore}
          subtext="Network Average"
          sparkline={[600, 620, 615, 640, 635, 650, 660]}
        />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Activity Feed */}
        <div className="lg:col-span-2 space-y-8">
          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="status-pulse w-2 h-2" />
              <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Live Activity Feed</h3>
            </div>

            <div className="space-y-0 divide-y divide-border">
              {recentActivity.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <div
                    key={activity._id}
                    className="flex items-start gap-4 py-4 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                          {activity.agent?.name || 'Unknown Agent'}
                        </span>
                        {activity.agent && (
                          <GhostScoreBadge
                            score={activity.agent.ghostScore}
                            tier={activity.agent.tier as 'bronze' | 'silver' | 'gold' | 'platinum'}
                            showScore={false}
                            className="scale-75 origin-left"
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm mb-2">
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
                      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                        <span>{formatRelativeTime(activity.timestamp)}</span>
                        {activity.metadata?.scoreImpact && activity.metadata.scoreImpact > 0 && (
                          <span className="text-primary">
                            +{activity.metadata.scoreImpact} score
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Network Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  SOL
                </div>
                <h4 className="text-sm font-mono text-foreground font-bold">Solana Network</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Finality</span>
                  <span className="text-foreground font-mono font-bold">{solanaMetrics.finality}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">TPS</span>
                  <span className="text-foreground font-mono font-bold">
                    {solanaMetrics.tps.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Uptime</span>
                  <span className="text-primary font-mono font-bold">
                    {solanaMetrics.uptime}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  BASE
                </div>
                <h4 className="text-sm font-mono text-foreground font-bold">Base Network</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Finality</span>
                  <span className="text-foreground font-mono font-bold">{baseMetrics.finality}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">TPS</span>
                  <span className="text-foreground font-mono font-bold">
                    {baseMetrics.tps.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Uptime</span>
                  <span className="text-primary font-mono font-bold">
                    {baseMetrics.uptime}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="p-6 bg-card border border-border rounded-xl">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-6">Top Agents</h3>

            <div className="space-y-1">
              {topAgents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No agents yet
                </div>
              ) : (
                topAgents.map((rep, index) => (
                  <div
                    key={rep._id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-mono text-primary">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {rep.agent?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Score: {rep.overallScore}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Quick Links</h3>
            <ToolGrid columns={2} className="gap-2">
              <ToolCard
                name="Directory"
                description="Browse services"
                href="/observatory/directory"
                className="p-4"
                badge="NEW"
              />
              <ToolCard
                name="Verify"
                description="Test endpoints"
                href="/observatory/verify"
                className="p-4"
                badge="NEW"
              />
              <ToolCard
                name="Payments"
                description="x402 activity"
                href="/observatory/payments"
                className="p-4"
              />
              <ToolCard
                name="Facilitators"
                description="Payment providers"
                href="/observatory/facilitators"
                className="p-4"
              />
              <ToolCard
                name="Endpoints"
                description="API registry"
                href="/observatory/endpoints"
                className="p-4"
              />
              <ToolCard
                name="Agents"
                description="Agent directory"
                href="/observatory/agents"
                className="p-4"
              />
            </ToolGrid>
          </div>
        </div>
      </div>
    </div>
  )
}
