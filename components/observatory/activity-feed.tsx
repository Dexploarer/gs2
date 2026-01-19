'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GhostScoreBadge } from '@/components/ghost-score-badge'

// This will be replaced with Convex useQuery for real-time updates
interface Activity {
  id: string
  agentId: string
  agent: {
    name: string
    address: string
    ghostScore: number
    tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  }
  type: 'payment' | 'endpoint_call' | 'credential_issued' | 'score_change' | 'tier_change'
  description: string
  metadata?: {
    endpoint?: string
    amount?: number
    oldScore?: number
    newScore?: number
  }
  impactOnScore?: number
  timestamp: number
}

interface ActivityFeedProps {
  activities: Activity[]
  showLiveIndicator?: boolean
  maxItems?: number
}

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'payment':
      return '💳'
    case 'endpoint_call':
      return '🔗'
    case 'credential_issued':
      return '✓'
    case 'score_change':
      return '📈'
    case 'tier_change':
      return '⭐'
    default:
      return '•'
  }
}

const formatTimestamp = (timestamp: number) => {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString()
}

export function ActivityFeed({
  activities,
  showLiveIndicator = true,
  maxItems,
}: ActivityFeedProps) {
  const displayActivities = maxItems ? activities.slice(0, maxItems) : activities

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Real-time agent actions across the network</CardDescription>
          </div>
          {showLiveIndicator && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground">LIVE</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
            >
              <div className="text-2xl flex-shrink-0">{getActivityIcon(activity.type)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm truncate">{activity.agent.name}</span>
                  <GhostScoreBadge
                    score={activity.agent.ghostScore}
                    tier={activity.agent.tier}
                    showScore={false}
                    className="flex-shrink-0"
                  />
                </div>

                <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>{formatTimestamp(activity.timestamp)}</span>

                  {activity.metadata?.endpoint && (
                    <span className="font-mono">{activity.metadata.endpoint}</span>
                  )}

                  {activity.metadata?.amount && (
                    <Badge variant="secondary" className="text-xs">
                      ${activity.metadata.amount.toFixed(3)}
                    </Badge>
                  )}

                  {activity.impactOnScore !== undefined && activity.impactOnScore !== 0 && (
                    <Badge
                      variant={activity.impactOnScore > 0 ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {activity.impactOnScore > 0 ? '+' : ''}
                      {activity.impactOnScore} score
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}

          {displayActivities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
