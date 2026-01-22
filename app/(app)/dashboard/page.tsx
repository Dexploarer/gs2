'use client'

import { useQuery } from 'convex/react'
import { useConnector } from '@solana/connector'
import { api } from '@/convex/_generated/api'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { ToolCard, ToolGrid } from '@/components/ui/tool-card'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  const { connected, selectedAccount, connecting } = useConnector()

  const agent = useQuery(
    api.agents.getByAddress,
    connected && selectedAccount ? { address: selectedAccount } : 'skip'
  )

  const isAuthLoading = connecting || (connected && agent === undefined)

  const profile = useQuery(
    api.agentProfiles.get,
    agent ? { agentId: agent._id } : 'skip'
  )

  const txStats = useQuery(
    api.agentTransactions.getStats,
    agent ? { agentId: agent._id, timeRangeHours: 720 } : 'skip'
  )

  const activity = useQuery(
    api.agentActivity.getByAgent,
    agent ? { agentId: agent._id, limit: 5 } : 'skip'
  )

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground font-mono text-sm">LOADING...</div>
      </div>
    )
  }

  // Not connected
  if (!connected) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your agent&apos;s reputation and performance</p>
        </div>
        <div className="p-12 bg-card border border-border rounded-xl text-center">
          <div className="text-foreground font-semibold mb-4">Connect Your Wallet</div>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Connect your Solana wallet to view your agent&apos;s dashboard and track reputation.
          </p>
          <ConnectWalletButton />
        </div>
      </div>
    )
  }

  // Connected but no agent
  if (!agent) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your agent&apos;s reputation and performance</p>
        </div>
        <div className="p-12 bg-card border border-border rounded-xl text-center">
          <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="text-foreground font-semibold mb-4">No Agent Registered</div>
          <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
            No agent is registered with this wallet address.
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {selectedAccount?.slice(0, 6)}...{selectedAccount?.slice(-4)}
          </p>
        </div>
      </div>
    )
  }

  // Calculate stats
  const stats = {
    totalTransactions: txStats?.totalTransactions ?? profile?.totalRequests ?? 0,
    successRate: txStats?.successRate ?? (profile ? ((profile.successfulRequests / (profile.totalRequests || 1)) * 100) : 0),
    totalEarned: profile?.totalEarningsUSDC ?? txStats?.totalVolume ?? 0,
    activeDays: profile?.firstSeenAt
      ? Math.ceil((Date.now() - profile.firstSeenAt) / (24 * 60 * 60 * 1000))
      : 0,
  }

  // Tier progress
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
      {/* Agent Card */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">{agent.name}</h2>
            <p className="text-xs text-muted-foreground font-mono">
              {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
            </p>
          </div>
          <GhostScoreBadge score={agent.ghostScore} tier={agent.tier as 'bronze' | 'silver' | 'gold' | 'platinum'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Display */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Ghost Score</div>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-mono font-bold text-foreground">{agent.ghostScore}</span>
              {agent.ghostScore > 250 && (
                <span className="text-primary text-sm font-mono mb-2">+{agent.ghostScore - 250}</span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col justify-end">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span className="capitalize font-semibold">{agent.tier} Tier</span>
              <span>{agent.ghostScore} / {currentTierInfo.max} → {nextTierName}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progressToNextTier}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <StatGrid columns={4}>
        <StatCard
          label="Transactions"
          value={stats.totalTransactions.toLocaleString()}
          trend={{ value: '24h', direction: 'neutral' }}
        />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          trend={{ value: '+2.1%', direction: 'up' }}
        />
        <StatCard
          label="Total Earned"
          value={`$${stats.totalEarned.toFixed(2)}`}
          trend={{ value: '30d', direction: 'neutral' }}
        />
        <StatCard
          label="Active Days"
          value={stats.activeDays}
        />
      </StatGrid>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Quick Actions</h3>
        </div>
        <ToolGrid columns={3}>
          <ToolCard
            name="View Credentials"
            description="Manage W3C verifiable credentials for your agent"
            href={`/agents/${agent.address}`}
            badge="W3C"
          />
          <ToolCard
            name="Stake Tokens"
            description="Stake tokens to become a validator and earn rewards"
            href="/staking"
            cost="Min 100 GHOST"
          />
          <ToolCard
            name="Observatory"
            description="Monitor x402 ecosystem activity and facilitators"
            href="/observatory"
            status="active"
          />
        </ToolGrid>
      </div>

      {/* Recent Activity */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-6">
          <div className="status-pulse w-2 h-2" />
          <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Recent Activity</h3>
        </div>

        <div className="space-y-0 divide-y divide-border">
          {activity === undefined ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : activity.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No recent activity</div>
          ) : (
            activity.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between py-4"
              >
                <div>
                  <div className="text-foreground text-sm mb-1">
                    {item.activityType === 'payment' && 'Payment received'}
                    {item.activityType === 'endpoint_call' && 'Service delivered'}
                    {item.activityType === 'credential_issued' && 'Credential earned'}
                    {item.activityType === 'score_change' && 'Score updated'}
                    {item.activityType === 'tier_change' && 'Tier upgraded'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                  </div>
                </div>
                {item.impactOnScore !== undefined && item.impactOnScore !== 0 && (
                  <div className={`text-sm font-mono font-bold ${item.impactOnScore > 0 ? 'text-primary' : 'text-red-400'
                    }`}>
                    {item.impactOnScore > 0 ? '+' : ''}{item.impactOnScore}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
