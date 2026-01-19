'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import Link from 'next/link'
import type { Id } from '@/convex/_generated/dataModel'

// Helper to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const weeks = Math.floor(diff / 604800000)

  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`
}

export default function ReputationTimelinePage() {
  const [selectedAgentId, setSelectedAgentId] = useState<Id<'agents'> | null>(null)

  // Fetch real data from Convex
  const topAgents = useQuery(api.reputationScores.getTopAgents, { limit: 10 })
  const trustEvents = useQuery(api.scoreHistory.getTrustEvents, {
    agentId: selectedAgentId ?? undefined,
    limit: 10,
  })

  // Get score history for selected agent (or first agent if none selected)
  const firstAgentId = topAgents?.[0]?.subjectAgentId
  const activeAgentId = selectedAgentId ?? firstAgentId
  const scoreHistory = useQuery(
    api.scoreHistory.getForAgent,
    activeAgentId ? { agentId: activeAgentId, days: 30 } : 'skip'
  )
  const agentStats = useQuery(
    api.scoreHistory.getStatsForAgent,
    activeAgentId ? { agentId: activeAgentId } : 'skip'
  )

  // Loading state
  if (topAgents === undefined || trustEvents === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading Reputation Data...</div>
      </div>
    )
  }

  // Find selected agent details
  const selectedAgent = selectedAgentId
    ? topAgents.find((a) => a.subjectAgentId === selectedAgentId)
    : topAgents[0]

  // Calculate chart stats
  const chartData = scoreHistory ?? []
  const maxScore = chartData.length > 0 ? Math.max(...chartData.map((d) => d.score)) : 1000

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/observatory"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← Back to Observatory
        </Link>
        <h1 className="text-4xl font-bold tracking-tight mb-2 mt-2">Reputation Timeline</h1>
        <p className="text-muted-foreground">
          Track Ghost Score evolution and trust events across all agents
        </p>
      </div>

      {/* Agent Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Agent</CardTitle>
          <CardDescription>View reputation history for specific agents</CardDescription>
        </CardHeader>
        <CardContent>
          {topAgents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No agents found. Register an agent to track reputation.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topAgents.slice(0, 4).map((rep) => (
                <div
                  key={rep._id}
                  onClick={() =>
                    rep.subjectAgentId && setSelectedAgentId(rep.subjectAgentId)
                  }
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedAgentId === rep.subjectAgentId ||
                    (!selectedAgentId && rep === topAgents[0])
                      ? 'border-primary bg-accent/50'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold">{rep.agent?.name || 'Unknown Agent'}</div>
                      <div className="text-sm text-muted-foreground">
                        {rep.trend === 'rising' ? '↑' : rep.trend === 'falling' ? '↓' : '→'}{' '}
                        {rep.trend || 'stable'} trend
                      </div>
                    </div>
                  </div>
                  {rep.agent && (
                    <GhostScoreBadge
                      score={rep.agent.ghostScore}
                      tier={rep.agent.tier as 'bronze' | 'silver' | 'gold' | 'platinum'}
                      showScore={true}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Chart */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ghost Score History</CardTitle>
              <CardDescription>
                30-day score progression for {selectedAgent?.agent?.name || 'selected agent'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No score history available
                </div>
              ) : (
                <>
                  <div className="h-64 flex items-end justify-between gap-1">
                    {chartData.map((data, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gradient-to-t from-purple-500/20 to-purple-500/40 hover:to-purple-500/60 transition-colors rounded-t min-h-[4px]"
                          style={{ height: `${(data.score / (maxScore * 1.1)) * 100}%` }}
                          title={`Day ${data.day}: ${Math.round(data.score)}`}
                        />
                        {i % 5 === 0 && (
                          <span className="text-xs text-muted-foreground">{data.day}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Starting</div>
                      <div className="font-semibold">
                        {agentStats?.startScore ?? Math.round(chartData[0]?.score ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Current</div>
                      <div
                        className={`font-semibold ${
                          (agentStats?.change ?? 0) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {agentStats?.currentScore ??
                          Math.round(chartData[chartData.length - 1]?.score ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Change</div>
                      <div
                        className={`font-semibold ${
                          (agentStats?.change ?? 0) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {(agentStats?.change ?? 0) >= 0 ? '+' : ''}
                        {agentStats?.change ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Trend</div>
                      <div className="font-semibold">
                        {agentStats?.trend === 'up'
                          ? '↑ Increasing'
                          : agentStats?.trend === 'down'
                            ? '↓ Decreasing'
                            : '→ Stable'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Trust Events Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Trust Events</CardTitle>
              <CardDescription>Recent events affecting agent reputation</CardDescription>
            </CardHeader>
            <CardContent>
              {trustEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No trust events recorded yet
                </div>
              ) : (
                <div className="space-y-4">
                  {trustEvents.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            event.type === 'credential_issued'
                              ? 'bg-blue-950/50 text-blue-400'
                              : event.type === 'tier_change'
                                ? 'bg-yellow-950/50 text-yellow-400'
                                : event.type === 'payment'
                                  ? 'bg-green-950/50 text-green-400'
                                  : 'bg-purple-950/50 text-purple-400'
                          }`}
                        >
                          {event.type === 'credential_issued'
                            ? '✓'
                            : event.type === 'tier_change'
                              ? '★'
                              : event.type === 'payment'
                                ? '$'
                                : '↑'}
                        </div>
                        {index < trustEvents.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border my-1" />
                        )}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 pb-8">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{event.title}</span>
                          {event.impact !== 0 && (
                            <Badge
                              variant={event.impact > 0 ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {event.impact > 0 ? '+' : ''}
                              {event.impact} score
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{event.description}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Milestones */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
              <CardDescription>Achievement progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentStats ? (
                <>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{agentStats.nextTier} Tier</span>
                      <span className="text-muted-foreground">
                        {agentStats.currentScore} /{' '}
                        {agentStats.nextTier === 'Silver'
                          ? 500
                          : agentStats.nextTier === 'Gold'
                            ? 750
                            : agentStats.nextTier === 'Platinum'
                              ? 900
                              : 1000}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                        style={{
                          width: `${Math.min(
                            100,
                            (agentStats.currentScore /
                              (agentStats.nextTier === 'Silver'
                                ? 500
                                : agentStats.nextTier === 'Gold'
                                  ? 750
                                  : agentStats.nextTier === 'Platinum'
                                    ? 900
                                    : 1000)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {agentStats.pointsToNextTier > 0
                        ? `${agentStats.pointsToNextTier} points to go`
                        : 'Maximum tier reached!'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Select an agent to view milestones
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tier Benefits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-900/50">
                <div className="font-semibold text-purple-400 mb-1">Platinum (900-1000)</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Priority endpoint listing</li>
                  <li>• 0% platform fees</li>
                  <li>• Advanced analytics</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-yellow-950/20 border border-yellow-900/50">
                <div className="font-semibold text-yellow-400 mb-1">Gold (750-899)</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Featured in directory</li>
                  <li>• 1% platform fees</li>
                  <li>• Premium support</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-gray-950/20 border border-gray-700/50">
                <div className="font-semibold text-gray-400 mb-1">Silver (500-749)</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Standard listing</li>
                  <li>• 2% platform fees</li>
                  <li>• Basic support</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/50">
                <div className="font-semibold text-amber-600 mb-1">Bronze (0-499)</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Basic listing</li>
                  <li>• 3% platform fees</li>
                  <li>• Community support</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
