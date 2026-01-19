'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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

export default function PaymentAnalyticsPage() {
  // Fetch real data from Convex
  const paymentStats = useQuery(api.x402Payments.getStats, {})
  const networkStats = useQuery(api.x402Payments.getStatsByNetwork, {})
  const facilitatorStats = useQuery(api.x402Payments.getStatsByFacilitator, {})
  const hourlyStats = useQuery(api.x402Payments.getHourlyStats, { hours: 24 })
  const recentPayments = useQuery(api.x402Payments.getRecent, { limit: 10 })

  // Loading state
  if (
    paymentStats === undefined ||
    networkStats === undefined ||
    facilitatorStats === undefined ||
    hourlyStats === undefined ||
    recentPayments === undefined
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading Payment Analytics...</div>
      </div>
    )
  }

  // Calculate avg payment amount
  const avgPayment = paymentStats.total > 0 ? paymentStats.totalVolume / paymentStats.total : 0

  // Calculate max hourly payments for chart scaling
  const maxHourlyPayments = Math.max(...hourlyStats.map((h) => h.payments), 1)

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
          <h1 className="text-4xl font-bold tracking-tight mb-2 mt-2">Payment Analytics</h1>
          <p className="text-muted-foreground">
            Deep dive into x402 payments across Solana and Base networks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export Data</Button>
          <Button>Generate Report</Button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {paymentStats.total >= 1_000_000
                ? `${(paymentStats.total / 1_000_000).toFixed(1)}M`
                : paymentStats.total.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">All-time</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${paymentStats.totalVolume >= 1_000_000
                ? `${(paymentStats.totalVolume / 1_000_000).toFixed(2)}M`
                : paymentStats.totalVolume.toLocaleString()}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              {paymentStats.completed.toLocaleString()} completed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {paymentStats.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {paymentStats.failed.toLocaleString()} failed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Payment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${avgPayment.toFixed(3)}</div>
            <div className="text-sm text-muted-foreground mt-1">Per transaction</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Network Breakdown</CardTitle>
            <CardDescription>Payments by blockchain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Solana</Badge>
                    <span className="text-sm font-medium">
                      {networkStats.solana.count.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ${networkStats.solana.volume >= 1_000_000
                      ? `${(networkStats.solana.volume / 1_000_000).toFixed(2)}M`
                      : networkStats.solana.volume.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${networkStats.total > 0 ? (networkStats.solana.count / networkStats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {networkStats.total > 0
                      ? Math.round((networkStats.solana.count / networkStats.total) * 100)
                      : 0}% of total
                  </span>
                  <span>Avg fee: ${networkStats.solana.avgFee.toFixed(5)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Base</Badge>
                    <span className="text-sm font-medium">
                      {networkStats.base.count.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ${networkStats.base.volume >= 1_000_000
                      ? `${(networkStats.base.volume / 1_000_000).toFixed(2)}M`
                      : networkStats.base.volume.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${networkStats.total > 0 ? (networkStats.base.count / networkStats.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {networkStats.total > 0
                      ? Math.round((networkStats.base.count / networkStats.total) * 100)
                      : 0}% of total
                  </span>
                  <span>Avg fee: ${networkStats.base.avgFee.toFixed(5)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facilitator Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Facilitator Performance</CardTitle>
            <CardDescription>Payment processors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {facilitatorStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No facilitator data yet
              </div>
            ) : (
              <div className="space-y-4">
                {facilitatorStats.slice(0, 3).map((f) => (
                  <div key={f.slug} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center font-bold text-xs">
                          {f.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {f.count.toLocaleString()} payments
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-green-950/50 text-green-400 border-green-900">
                        {f.successRate.toFixed(1)}% success
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Primary Network</div>
                        <div className="font-medium capitalize">{f.primaryNetwork}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Finality</div>
                        <div className="font-medium">{f.avgFinality || 'N/A'}ms</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly Chart */}
      <Card>
        <CardHeader>
          <CardTitle>24-Hour Payment Activity</CardTitle>
          <CardDescription>Payments and volume by hour</CardDescription>
        </CardHeader>
        <CardContent>
          {hourlyStats.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No payment data in the last 24 hours
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-1">
              {hourlyStats.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/20 hover:bg-primary/40 transition-colors rounded-t min-h-[4px]"
                    style={{ height: `${(data.payments / maxHourlyPayments) * 100}%` }}
                    title={`${data.hour}: ${data.payments} payments, $${data.volume.toFixed(2)}`}
                  />
                  {i % 4 === 0 && (
                    <span className="text-xs text-muted-foreground">
                      {data.hour.split(':')[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Latest x402 transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments recorded yet
            </div>
          ) : (
            <div className="space-y-2">
              {recentPayments.map((payment) => (
                <div
                  key={payment._id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {payment.agent?.name || 'Unknown Agent'}
                      </span>
                      <Badge
                        variant={payment.status === 'completed' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {payment.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {payment.endpoint}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="font-semibold">${payment.amount.toFixed(3)}</div>
                      <div className="text-xs text-muted-foreground">{payment.network}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Response</div>
                      <div
                        className={`font-mono text-xs ${
                          (payment.responseTime || 0) < 500
                            ? 'text-green-600 dark:text-green-400'
                            : (payment.responseTime || 0) < 2000
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {payment.responseTime || 'N/A'}ms
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground w-20 text-right">
                      {formatRelativeTime(payment.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
