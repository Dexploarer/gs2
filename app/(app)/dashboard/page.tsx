'use client'

import { useQuery } from 'convex/react'
import { useConnector } from '@solana/connector'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  // Get wallet connection status
  const { connected, selectedAccount, connecting } = useConnector()

  // Look up agent by connected wallet address
  const agent = useQuery(
    api.agents.getByAddress,
    connected && selectedAccount ? { address: selectedAccount } : 'skip'
  )

  // Loading state for wallet auth
  const isAuthLoading = connecting || (connected && agent === undefined)

  // Fetch agent profile for stats (only if we have an agent)
  const profile = useQuery(
    api.agentProfiles.get,
    agent ? { agentId: agent._id } : 'skip'
  )

  // Fetch transaction stats for this agent
  const txStats = useQuery(
    api.agentTransactions.getStats,
    agent ? { agentId: agent._id, timeRangeHours: 720 } : 'skip' // Last 30 days
  )

  // Fetch recent activity for this agent
  const activity = useQuery(
    api.agentActivity.getByAgent,
    agent ? { agentId: agent._id, limit: 5 } : 'skip'
  )

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  // Not connected - show connect wallet prompt
  if (!connected) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your agent&apos;s reputation and performance
          </p>
        </div>
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-lg font-medium">Connect Your Wallet</div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Connect your Solana wallet to view your agent&apos;s dashboard and track
              reputation in the x402 ecosystem.
            </p>
            <ConnectWalletButton size="lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Connected but no agent registered
  if (!agent) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your agent&apos;s reputation and performance
          </p>
        </div>
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-lg font-medium">No Agent Registered</div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No agent is registered with this wallet address. Register your AI agent
              to start building reputation in the x402 ecosystem.
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Connected: {selectedAccount?.slice(0, 8)}...{selectedAccount?.slice(-8)}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate stats from profile or fallback to transaction stats
  const stats = {
    totalTransactions: txStats?.totalTransactions ?? profile?.totalRequests ?? 0,
    successRate: txStats?.successRate ?? (profile ? ((profile.successfulRequests / (profile.totalRequests || 1)) * 100) : 0),
    totalEarned: profile?.totalEarningsUSDC ?? txStats?.totalVolume ?? 0,
    activeDays: profile?.firstSeenAt
      ? Math.ceil((Date.now() - profile.firstSeenAt) / (24 * 60 * 60 * 1000))
      : 0,
  }

  // Calculate tier progress
  const tierThresholds = {
    bronze: { min: 0, max: 500 },
    silver: { min: 500, max: 750 },
    gold: { min: 750, max: 900 },
    platinum: { min: 900, max: 1000 },
  }
  const currentTierInfo = tierThresholds[agent.tier as keyof typeof tierThresholds] || tierThresholds.bronze
  const nextTierName = agent.tier === 'bronze' ? 'Silver' : agent.tier === 'silver' ? 'Gold' : agent.tier === 'gold' ? 'Platinum' : 'Max'
  const progressToNextTier = agent.tier === 'platinum'
    ? 100
    : Math.min(100, ((agent.ghostScore - currentTierInfo.min) / (currentTierInfo.max - currentTierInfo.min)) * 100)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your agent&apos;s reputation and performance
        </p>
      </div>

      {/* Agent Score Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{agent.name}</CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                {agent.address}
              </CardDescription>
            </div>
            <GhostScoreBadge score={agent.ghostScore} tier={agent.tier as 'bronze' | 'silver' | 'gold' | 'platinum'} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Ghost Score</div>
              <div className="flex items-end gap-2">
                <div className="text-5xl font-bold tracking-tight">{agent.ghostScore}</div>
                {agent.ghostScore > 250 && (
                  <div className="text-sm text-green-600 dark:text-green-400 pb-2">
                    +{agent.ghostScore - 250}
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="capitalize">{agent.tier} Tier</span>
                <span>
                  {agent.ghostScore} / {currentTierInfo.max} to {nextTierName}
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${
                    agent.tier === 'platinum' ? 'from-purple-500 to-purple-600' :
                    agent.tier === 'gold' ? 'from-yellow-500 to-yellow-600' :
                    agent.tier === 'silver' ? 'from-gray-400 to-gray-500' :
                    'from-orange-500 to-orange-600'
                  }`}
                  style={{ width: `${progressToNextTier}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalTransactions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.successRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Earned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${stats.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeDays}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest transactions and score changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activity === undefined ? (
              <div className="text-sm text-muted-foreground py-4">Loading activity...</div>
            ) : activity.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">No recent activity</div>
            ) : (
              activity.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <div className="font-medium">
                      {item.activityType === 'payment' && 'Payment received'}
                      {item.activityType === 'endpoint_call' && 'Service delivered'}
                      {item.activityType === 'credential_issued' && 'Credential earned'}
                      {item.activityType === 'score_change' && 'Score updated'}
                      {item.activityType === 'tier_change' && 'Tier upgraded'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                  {item.impactOnScore !== undefined && item.impactOnScore !== 0 && (
                    <div className={`text-sm font-semibold ${
                      item.impactOnScore > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {item.impactOnScore > 0 ? '+' : ''}{item.impactOnScore}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
