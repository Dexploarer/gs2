'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useConnector } from '@solana/connector'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import { RegisterTokenForm } from '@/components/staking/register-token-form'
import { StakeTokensForm } from '@/components/staking/stake-tokens-form'
import { MyStakesView } from '@/components/staking/my-stakes-view'
import { Coins, TrendingUp, Users, Wallet, Plus, ArrowUpRight } from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'

type TabType = 'overview' | 'register' | 'stake' | 'my-stakes'

export function StakingPageClient() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Get wallet connection status
  const { connected, selectedAccount, connecting } = useConnector()

  // Look up agent by connected wallet address
  const agent = useQuery(
    api.agents.getByAddress,
    connected && selectedAccount ? { address: selectedAccount } : 'skip'
  )

  // Fetch all active staking tokens
  const stakingTokens = useQuery(api.tokenStaking.listActive, { limit: 20 })

  // Fetch staking stats for connected agent
  const stakingStats = useQuery(
    api.tokenStaking.getStatsForAgent,
    agent ? { agentId: agent._id } : 'skip'
  )

  // Fetch stakes made by connected wallet
  const myStakes = useQuery(
    api.tokenStaking.getStakesByStaker,
    connected && selectedAccount ? { stakerAddress: selectedAccount } : 'skip'
  )

  // Loading state
  const isAuthLoading = connecting || (connected && agent === undefined)

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading staking...</div>
      </div>
    )
  }

  // Not connected
  if (!connected) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">BYOT Staking</h1>
          <p className="text-muted-foreground">
            Stake tokens on agents to signal trust with economic commitment
          </p>
        </div>
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Coins className="h-12 w-12 text-muted-foreground" />
            <div className="text-lg font-medium">Connect Your Wallet</div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Connect your Solana wallet to register staking tokens, stake on agents,
              and manage your positions.
            </p>
            <ConnectWalletButton size="lg" />
          </CardContent>
        </Card>

        {/* Show available tokens even when not connected */}
        <StakingTokensList tokens={stakingTokens} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">BYOT Staking</h1>
          <p className="text-muted-foreground">
            Bring Your Own Token staking for trust attestations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'register' ? 'default' : 'outline'}
            onClick={() => setActiveTab('register')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Register Token
          </Button>
          <Button
            variant={activeTab === 'stake' ? 'default' : 'outline'}
            onClick={() => setActiveTab('stake')}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Stake
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border pb-2">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'register', label: 'Register Token' },
          { id: 'stake', label: 'Stake on Agent' },
          { id: 'my-stakes', label: 'My Stakes' },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id as TabType)}
          >
            {tab.label}
            {tab.id === 'my-stakes' && myStakes && myStakes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {myStakes.length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Active Stakes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {myStakes?.filter(s => s.status === 'active').length ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Trust Weight
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stakingStats?.totalWeight?.toFixed(1) ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Unique Stakers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stakingStats?.uniqueStakers ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Total Value Staked
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stakingStats?.totalStakedValue?.toLocaleString() ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent's Registered Tokens */}
          {agent && (
            <Card>
              <CardHeader>
                <CardTitle>Your Registered Tokens</CardTitle>
                <CardDescription>
                  Tokens you&apos;ve registered for staking on your agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgentTokensList agentId={agent._id} />
              </CardContent>
            </Card>
          )}

          {/* All Staking Tokens */}
          <StakingTokensList tokens={stakingTokens} />
        </div>
      )}

      {activeTab === 'register' && (
        <RegisterTokenForm
          agent={agent}
          onSuccess={() => setActiveTab('overview')}
        />
      )}

      {activeTab === 'stake' && (
        <StakeTokensForm
          stakerAddress={selectedAccount!}
          stakerAgent={agent}
          stakingTokens={stakingTokens ?? []}
          onSuccess={() => setActiveTab('my-stakes')}
        />
      )}

      {activeTab === 'my-stakes' && (
        <MyStakesView
          stakerAddress={selectedAccount!}
          stakes={myStakes ?? []}
        />
      )}
    </div>
  )
}

// Component to show staking tokens list
function StakingTokensList({ tokens }: { tokens: typeof api.tokenStaking.listActive._returnType | undefined }) {
  if (!tokens || tokens.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Available Staking Tokens</CardTitle>
          <CardDescription>No staking tokens registered yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Be the first to register a token for staking and enable trust attestations.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Staking Tokens</CardTitle>
        <CardDescription>
          {tokens.length} token{tokens.length !== 1 ? 's' : ''} available for staking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tokens.map((token) => (
            <div
              key={token._id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold">{token.tokenSymbol.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-medium">{token.tokenName}</div>
                  <div className="text-sm text-muted-foreground">
                    ${token.tokenSymbol} &middot; Min: {token.minStakeAmount.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{token.totalStaked.toLocaleString()} staked</div>
                <div className="text-sm text-muted-foreground">
                  {token.stakerCount} staker{token.stakerCount !== 1 ? 's' : ''}
                </div>
              </div>
              {token.owner && (
                <Badge variant="outline" className="ml-4">
                  {token.owner.type === 'agent' ? 'Agent' : 'Merchant'}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Component to show agent's registered tokens
function AgentTokensList({ agentId }: { agentId: Id<'agents'> }) {
  const tokens = useQuery(api.tokenStaking.getForAgent, { agentId })

  if (!tokens || tokens.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No tokens registered. Register a token to allow others to stake on you.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <div
          key={token._id}
          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className="font-medium">{token.tokenSymbol}</div>
            <div className="text-sm text-muted-foreground">{token.tokenName}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Min:</span>{' '}
              {token.minStakeAmount.toLocaleString()}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Lock:</span>{' '}
              {Math.floor(token.lockPeriodSeconds / 86400)}d
            </div>
            <Badge variant={token.isVerified ? 'default' : 'secondary'}>
              {token.isVerified ? 'Verified' : 'Pending'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
