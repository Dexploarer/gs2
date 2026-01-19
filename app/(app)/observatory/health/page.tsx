'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// Helper to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(diff / 60000)

  if (seconds < 60) return `${seconds}s ago`
  return `${minutes}m ago`
}

export default function SystemHealthPage() {
  // Fetch real data from Convex
  const systemHealth = useQuery(api.systemMetrics.getSystemHealth, {})
  const solanaMetrics = useQuery(api.systemMetrics.getNetworkMetrics, { network: 'solana' })
  const baseMetrics = useQuery(api.systemMetrics.getNetworkMetrics, { network: 'base' })
  const facilitatorHealth = useQuery(api.facilitatorHealth.getLatestForAll, {})
  const latencyHistory = useQuery(api.systemMetrics.getLatencyHistory, { minutes: 60 })
  const facilitatorStats = useQuery(api.facilitators.getStats, {})

  // Loading state
  if (
    systemHealth === undefined ||
    solanaMetrics === undefined ||
    baseMetrics === undefined ||
    facilitatorHealth === undefined ||
    latencyHistory === undefined ||
    facilitatorStats === undefined
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading System Health...</div>
      </div>
    )
  }

  // Calculate network uptime average
  const networkUptime = ((solanaMetrics.uptime + baseMetrics.uptime) / 2).toFixed(2)

  // Calculate latency stats
  const latencyValues = latencyHistory.map((d) => d.latency)
  const minLatency = Math.min(...latencyValues)
  const maxLatency = Math.max(...latencyValues)
  const avgLatency = Math.round(latencyValues.reduce((sum, v) => sum + v, 0) / latencyValues.length)

  // Overall status badge colors
  const statusColors = {
    operational: 'bg-green-950/50 text-green-400 border-green-900',
    degraded: 'bg-yellow-950/50 text-yellow-400 border-yellow-900',
    offline: 'bg-red-950/50 text-red-400 border-red-900',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/observatory"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to Observatory
          </Link>
          <h1 className="text-4xl font-bold tracking-tight mb-2 mt-2">System Health</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of networks, facilitators, and infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full animate-pulse ${
              systemHealth.status === 'operational'
                ? 'bg-green-500'
                : systemHealth.status === 'degraded'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-medium capitalize">
            {systemHealth.status === 'operational' ? 'All Systems Operational' : systemHealth.status}
          </span>
        </div>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={
            systemHealth.status === 'operational'
              ? 'border-green-900/50 bg-green-950/20'
              : systemHealth.status === 'degraded'
                ? 'border-yellow-900/50 bg-yellow-950/20'
                : 'border-red-900/50 bg-red-950/20'
          }
        >
          <CardHeader className="pb-3">
            <CardDescription>Overall Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold capitalize ${
                systemHealth.status === 'operational'
                  ? 'text-green-400'
                  : systemHealth.status === 'degraded'
                    ? 'text-yellow-400'
                    : 'text-red-400'
              }`}
            >
              {systemHealth.status}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {systemHealth.status === 'operational'
                ? 'All services running'
                : `${systemHealth.activeAlerts} active alerts`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Network Uptime</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{networkUptime}%</div>
            <div className="text-sm text-muted-foreground mt-1">30-day average</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                systemHealth.activeAlerts > 0 ? 'text-yellow-400' : 'text-green-400'
              }`}
            >
              {systemHealth.activeAlerts}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {systemHealth.activeAlerts === 0 ? 'No issues' : 'Requires attention'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Solana Network</CardTitle>
                <CardDescription>Devnet performance metrics</CardDescription>
              </div>
              <Badge className={statusColors.operational}>operational</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Finality</div>
                <div className="text-2xl font-bold">{solanaMetrics.finality}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">TPS</div>
                <div className="text-2xl font-bold">{solanaMetrics.tps.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Uptime (30d)</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {solanaMetrics.uptime}%
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <div className="text-2xl font-bold">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Base Network</CardTitle>
                <CardDescription>EVM L2 performance metrics</CardDescription>
              </div>
              <Badge className={statusColors.operational}>operational</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Finality</div>
                <div className="text-2xl font-bold">{baseMetrics.finality}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">TPS</div>
                <div className="text-2xl font-bold">{baseMetrics.tps.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Uptime (30d)</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {baseMetrics.uptime}%
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <div className="text-2xl font-bold">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Convex Backend */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Convex Backend</CardTitle>
              <CardDescription>Serverless database and real-time sync</CardDescription>
            </div>
            <Badge className={statusColors.operational}>healthy</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Avg Latency</div>
              <div className="text-2xl font-bold">{systemHealth.avgLatency}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Error Rate</div>
              <div
                className={`text-2xl font-bold ${
                  systemHealth.errorRate > 5 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {systemHealth.errorRate.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Facilitators</div>
              <div className="text-2xl font-bold">{facilitatorStats.active}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Daily Transactions</div>
              <div className="text-2xl font-bold">
                {facilitatorStats.totalDailyTransactions.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facilitators */}
      <Card>
        <CardHeader>
          <CardTitle>x402 Facilitators</CardTitle>
          <CardDescription>Payment processor status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {facilitatorHealth.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No facilitators registered yet
            </div>
          ) : (
            facilitatorHealth.map((f) => (
              <div
                key={f.facilitatorId}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      f.health?.status === 'online'
                        ? 'bg-green-500'
                        : f.health?.status === 'degraded'
                          ? 'bg-yellow-500'
                          : f.health?.status === 'offline'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                    }`}
                  />
                  <div>
                    <div className="font-semibold">{f.facilitatorName}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.health
                        ? `Last checked ${formatRelativeTime(f.health.timestamp)}`
                        : 'No health data'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {f.health?.uptime24h ? `${f.health.uptime24h.toFixed(1)}%` : 'N/A'} uptime
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {f.health?.responseTime ? `${f.health.responseTime}ms` : 'N/A'} avg
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Latency Graph */}
      <Card>
        <CardHeader>
          <CardTitle>API Latency (Last Hour)</CardTitle>
          <CardDescription>Average response time in milliseconds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end justify-between gap-0.5">
            {latencyHistory.map((data, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t min-h-[2px]"
                style={{ height: `${(data.latency / (maxLatency * 1.2)) * 100}%` }}
                title={`${Math.round(data.latency)}ms`}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-between text-sm">
            <div>
              <div className="text-muted-foreground">Min</div>
              <div className="font-semibold">{Math.round(minLatency)}ms</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg</div>
              <div className="font-semibold">{avgLatency}ms</div>
            </div>
            <div>
              <div className="text-muted-foreground">Max</div>
              <div className="font-semibold">{Math.round(maxLatency)}ms</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
