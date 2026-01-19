'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AgentCard } from '@/components/agent/agent-card'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Reputation score type from getTopAgents query
type ReputationScore = Doc<'reputationScores'> & {
  agent: {
    name: string
    address: string
    ghostScore: number
    tier: string
  } | null
}

export default function AgentsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'active' | 'rising' | 'high-score'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // Fetch agents
  const agents = useQuery(api.agents.list, { limit: 1000 })

  // Fetch reputation scores for all agents
  const topAgents = useQuery(api.reputationScores.getTopAgents, { limit: 100 })

  // Fetch agent stats
  const agentStats = useQuery(api.agentProfiles.getStats, {})

  // Fetch category stats for filter dropdown
  const categoryStats = useQuery(api.agents.getCategoryStats, {})

  if (agents === undefined || topAgents === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading agents...</div>
      </div>
    )
  }

  // Create a map of agent reputations
  const reputationMap = new Map<Id<'agents'>, ReputationScore>(
    topAgents.map((rep) => [rep.subjectAgentId as Id<'agents'>, rep as ReputationScore])
  )

  // Filter agents
  let filteredAgents = agents

  if (filter === 'active') {
    filteredAgents = filteredAgents.filter((a) => a.isActive)
  } else if (filter === 'rising') {
    filteredAgents = filteredAgents.filter((a) => {
      const rep = reputationMap.get(a._id)
      return rep?.trend === 'rising'
    })
  } else if (filter === 'high-score') {
    filteredAgents = filteredAgents
      .filter((a) => a.ghostScore >= 800)
      .sort((a, b) => b.ghostScore - a.ghostScore)
  }

  // Category filter
  if (categoryFilter) {
    filteredAgents = filteredAgents.filter((a) => a.category === categoryFilter)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/observatory"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← Back to Observatory
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Agent Directory</h1>
            <p className="text-muted-foreground">
              Browse and discover AI agents in the x402 ecosystem
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {agentStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {agentStats.totalAgents.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {agentStats.activeAgents.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg Ghost Score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {Math.round(
                  topAgents.reduce((sum, r) => sum + (r.overallScore || 0), 0) / topAgents.length || 0
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Rising Agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {topAgents.filter((r) => r.trend === 'rising').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Filters */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={filter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilter('all')}
              >
                All Agents
              </Badge>
              <Badge
                variant={filter === 'active' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilter('active')}
              >
                Active Only
              </Badge>
              <Badge
                variant={filter === 'rising' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilter('rising')}
              >
                ↗ Rising
              </Badge>
              <Badge
                variant={filter === 'high-score' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilter('high-score')}
              >
                High Score (800+)
              </Badge>
            </div>
          </div>

          {/* Category Filters */}
          {categoryStats && categoryStats.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={categoryFilter === null ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter(null)}
                >
                  All Categories
                </Badge>
                {categoryStats.map((cat) => (
                  <Badge
                    key={cat.category}
                    variant={categoryFilter === cat.category ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setCategoryFilter(cat.category)}
                  >
                    {cat.category} ({cat.agentCount})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No agents found matching your filters
          </div>
        ) : (
          filteredAgents.slice(0, 50).map((agent) => {
            const reputation = reputationMap.get(agent._id)

            return (
              <AgentCard
                key={agent._id}
                agent={{
                  _id: agent._id,
                  name: agent.name,
                  address: agent.address,
                  ghostScore: agent.ghostScore,
                  tier: agent.tier,
                  isActive: agent.isActive,
                }}
                reputation={
                  reputation
                    ? {
                        overallScore: reputation.overallScore || 0,
                        trustScore: reputation.trustScore || 0,
                        qualityScore: reputation.qualityScore || 0,
                        reliabilityScore: reputation.reliabilityScore || 0,
                        economicScore: reputation.economicScore || 0,
                        socialScore: reputation.socialScore || 0,
                        trend: reputation.trend || 'stable',
                      }
                    : undefined
                }
                variant="default"
                onClick={() => router.push(`/observatory/agents/${agent.address}`)}
              />
            )
          })
        )}
      </div>

      {filteredAgents.length > 50 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Showing 50 of {filteredAgents.length} agents
        </div>
      )}
    </div>
  )
}
