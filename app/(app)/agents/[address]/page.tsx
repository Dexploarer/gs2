/**
 * Agent Profile Page
 * Redesigned with x402scan-inspired "Functional Minimalism"
 */

import Link from 'next/link'
import { getAgent, getAgentTransactions } from '@/lib/graphql-client'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { ToolCard, ToolGrid } from '@/components/ui/tool-card'
import { formatDistanceToNow } from 'date-fns'

interface PageProps {
  params: Promise<{
    address: string
  }>
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { address } = await params

  // Fetch agent data
  const agentData = await getAgent(address)
  const agent = agentData?.agent

  // Fetch transactions
  const txData = await getAgentTransactions(address, 10)
  const transactions = txData?.transactions || []

  if (!agent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Agent Not Found</h1>
          <p className="text-muted-foreground">The agent with address {address} could not be found.</p>
          <Link href="/agents" className="mt-4 inline-block text-primary hover:underline">
            ← Back to Directory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
        {/* Header / Hero */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center border border-border">
              <span className="text-4xl font-bold text-muted-foreground">
                {agent.name?.charAt(0) || '?'}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-mono font-bold text-foreground mb-2">
                  {agent.name || 'Anonymous Agent'}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm font-mono">
                  <span className="text-muted-foreground">{address}</span>
                  {agent.category && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">
                      {agent.category}
                    </span>
                  )}
                  {agent.isActive && (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Active
                    </div>
                  )}
                </div>
              </div>
              <GhostScoreBadge
                score={agent.reputation}
                tier="bronze"
                className="scale-110 origin-top-left md:origin-top-right"
              />
            </div>

            {agent.metadata?.description && (
              <p className="text-muted-foreground max-w-2xl leading-relaxed">
                {agent.metadata.description}
              </p>
            )}

            {agent.metadata?.tags && agent.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {agent.metadata.tags.map((tag: string) => (
                  <span key={tag} className="px-2 py-1 text-xs text-muted-foreground bg-muted rounded hover:text-foreground hover:bg-muted/80 transition-colors cursor-default">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <StatGrid columns={4} className="mb-12">
          <StatCard
            label="Reputation"
            value={agent.reputation}
            subtext="Ghost Score"
            trend={{ value: 'Top 5%', direction: 'up' }}
          />
          <StatCard
            label="Total Votes"
            value={agent.totalVotes.toLocaleString()}
            subtext={`${Math.round((agent.upvotes / (agent.totalVotes || 1)) * 100)}% positive`}
            trend={{ value: 'User Sentiment', direction: 'neutral' }}
          />
          <StatCard
            label="Avg Quality"
            value={agent.averageQuality.toFixed(2)}
            subtext="Performance Rating"
          />
          <StatCard
            label="Created"
            value={agent.createdAt ? formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true }) : 'Unknown'}
            subtext="Network Age"
          />
        </StatGrid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Capabilities & Transactions */}
          <div className="lg:col-span-2 space-y-8">
            {/* Capabilities */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Capabilities</h2>
              </div>
              <ToolGrid columns={2}>
                <ToolCard
                  name="Agent Service"
                  description="Primary autonomous agent service endpoint"
                  address={address}
                  status="active"
                  cost="$0.001 / req"
                />
                <ToolCard
                  name="Verifiable Credentials"
                  description="Issuer of W3C compliant credentials"
                  address={address}
                  status="active"
                  badge="Issuer"
                />
              </ToolGrid>
            </div>

            {/* Transactions */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="status-pulse w-2 h-2" />
                <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Transaction History</h2>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {transactions.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No transactions found
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="p-4 hover:bg-muted/60 transition-colors flex items-center justify-between group">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${tx.type === 'PAYMENT' ? 'bg-green-500/10 text-green-400' :
                              tx.type === 'VOTE' ? 'bg-blue-500/10 text-blue-400' :
                                'bg-muted text-muted-foreground'
                              }`}>
                              {tx.type}
                            </span>
                            <span className="text-foreground font-mono text-sm truncate">
                              {tx.signature.slice(0, 16)}...
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            Block: {tx.blockNumber}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground text-sm font-mono mb-1">
                            {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                          </div>
                          <a
                            href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                          >
                            TX ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="text-foreground font-semibold mb-4">Verification Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Identity</span>
                  <span className="text-green-600 text-sm font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Verified
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Source Code</span>
                  <span className="text-muted-foreground text-sm font-mono">Unverified</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Audit</span>
                  <span className="text-muted-foreground text-sm font-mono">None</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-card border border-border rounded-xl">
              <h3 className="text-foreground font-semibold mb-4">Connect</h3>
              <div className="space-y-3">
                {agent.metadata?.website && (
                  <a href={agent.metadata.website} target="_blank" rel="noopener noreferrer" className="block w-full py-2 px-3 bg-muted text-center text-sm text-muted-foreground hover:text-foreground rounded hover:bg-muted/80 transition-colors">
                    Website
                  </a>
                )}
                <button className="block w-full py-2 px-3 bg-primary text-black text-sm font-bold rounded hover:bg-primary-dark transition-colors btn-shimmer">
                  Interact
                </button>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}

export const revalidate = 60
