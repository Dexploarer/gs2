'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { ToolCard, ToolGrid } from '@/components/ui/tool-card'
import { useWallet } from '@solana/wallet-adapter-react'

interface ActiveToken {
  _id: string
  mint: string
  name?: string
  symbol?: string
  totalStaked?: number
  apr?: number
}

export function StakingPageClient() {
  const { connected } = useWallet()

  // Use correct API endpoints - we use tokenStaking for this
  const activeTokens = useQuery(api.tokenStaking.listActive, { limit: 10 }) as ActiveToken[] | undefined
  // We might not have a stats endpoint yet in tokenStaking, so we'll mock or calculate
  // For now using empty stats to prevent build error if api.staking doesn't exist
  const stats = {
    totalStaked: 0,
    activeValidators: activeTokens?.length || 0,
    totalValidators: 0,
    apy: 5.2
  }

  if (activeTokens === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Staking Overview</h1>
          <p className="text-muted-foreground">Loading staking data...</p>
        </div>
        <StatGrid columns={4}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 bg-card border border-border rounded-xl animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-3" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </StatGrid>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">
            Token Staking
          </h1>
          <p className="text-muted-foreground">
            Stake tokens on agents to signal trust and earn rewards
          </p>
        </div>
        {!connected && (
          <div className="px-4 py-2 bg-muted border border-dashed border-border rounded-lg text-sm text-muted-foreground">
            Connect wallet to manage stake
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Staked"
          value={`${(stats.totalStaked / 1_000_000).toFixed(2)}M`}
          subtext="GHOST tokens"
          trend={{ value: '+2.5%', direction: 'up' }}
        />
        <StatCard
          label="Active Tokens"
          value={stats.activeValidators}
          subtext="Stakable Assets"
        />
        <StatCard
          label="Current APY"
          value={`${stats.apy}%`}
          subtext="Estimated yield"
          trend={{ value: 'Stable', direction: 'neutral' }}
        />
        <StatCard
          label="Your Stake"
          value="0.00"
          subtext={connected ? "Value staked" : "Connect wallet"}
        />
      </StatGrid>

      {/* Staking Tokens List */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="status-pulse w-2 h-2" />
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Stakable Tokens
          </h2>
        </div>

        <ToolGrid columns={3}>
          {activeTokens.length > 0 ? activeTokens.map((token) => (
            <ToolCard
              key={token._id}
              name={token.name || 'Unknown Token'}
              description={`Symbol: ${token.symbol || '?'}`}
              address={token.mint}
              cost={`${token.apr || 0}% APR`}
              status={'active'}
              badge={(token.totalStaked ?? 0) > 100000 ? 'Hot' : undefined}
              className="h-full"
            />
          )) : (
            <>
              <ToolCard
                name="GHOST Token"
                description="Official governance token"
                address="GhsT...9x21"
                status="active"
                badge="Official"
                cost="5.2% APR"
              />
              <ToolCard
                name="USDC"
                description="Stablecoin staking"
                address="EPjF...1v"
                status="active"
                cost="3.1% APR"
              />
            </>
          )}
        </ToolGrid>
      </div>

      {/* Information Panel */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <h3 className="text-foreground font-semibold mb-4">Staking Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          <div>
            <h4 className="font-mono text-[#ccff00] mb-2">Unstaking Period</h4>
            <p className="text-muted-foreground">
              Unstaking takes approximately 2 epochs. During this time your tokens are not earning rewards and cannot be transferred.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-blue-400 mb-2">Risk Warning</h4>
            <p className="text-muted-foreground">
              Staking involves smart contract risk. Ensure you understand the slashing conditions for the agents you stake on.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
