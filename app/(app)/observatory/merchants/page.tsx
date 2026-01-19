'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

export default function MerchantsPage() {
  // Fetch merchants from Convex with facilitator data
  const merchants = useQuery(api.merchants.list, { activeOnly: true, limit: 50 })
  const stats = useQuery(api.merchants.getStats)

  // Loading state
  if (merchants === undefined || stats === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Merchants & Services</h1>
          <p className="text-muted-foreground">
            Discover x402-enabled services and AI agents offering paid APIs
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading merchants...</div>
        </div>
      </div>
    )
  }

  // Empty state
  if (merchants.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Merchants & Services</h1>
          <p className="text-muted-foreground">
            Discover x402-enabled services and AI agents offering paid APIs
          </p>
        </div>
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-lg font-medium">No Merchants Discovered</div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No x402-enabled merchants have been discovered yet. Merchants are automatically
              discovered via facilitator Bazaar endpoints every 30 minutes.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate stats from merchants data
  const _totalEndpoints = merchants.reduce((sum, m) => sum + m.endpoints.length, 0)
  const avgSuccessRate =
    merchants.length > 0
      ? merchants.reduce((sum, m) => sum + m.successRate, 0) / merchants.length
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Merchants & Services</h1>
        <p className="text-muted-foreground">
          Discover x402-enabled services and AI agents offering paid APIs
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Merchants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              {stats.active} active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalEndpoints}</div>
            <div className="text-sm text-muted-foreground mt-1">Available APIs</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {avgSuccessRate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">High reliability</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.categories}</div>
            <div className="text-sm text-muted-foreground mt-1">Service types</div>
          </CardContent>
        </Card>
      </div>

      {/* Merchant Listings */}
      <div className="space-y-4">
        {merchants.map((merchant) => (
          <Card key={merchant._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg">{merchant.name}</CardTitle>
                    {merchant.category && (
                      <Badge variant="secondary" className="text-xs">
                        {merchant.category}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {merchant.network}
                    </Badge>
                  </div>
                  <CardDescription>{merchant.description}</CardDescription>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {merchant.successRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Endpoints */}
                <div>
                  <div className="text-sm font-semibold mb-2">Endpoints</div>
                  <div className="space-y-2">
                    {merchant.endpoints.map((endpoint, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded border border-border text-sm"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {endpoint.method}
                          </Badge>
                          <code className="text-xs font-mono truncate">{endpoint.url}</code>
                        </div>
                        <div className="text-xs font-semibold text-primary ml-2 flex-shrink-0">
                          ${endpoint.priceUSDC.toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metadata row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Facilitator</div>
                    <div className="text-sm font-medium">
                      {merchant.facilitator?.name ?? 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Calls</div>
                    <div className="text-sm font-medium">{merchant.totalCalls.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Discovered</div>
                    <div className="text-sm font-medium">
                      {formatDistanceToNow(merchant.discoveredAt, { addSuffix: true })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Last Seen</div>
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                      {formatDistanceToNow(merchant.lastSeen, { addSuffix: true })}
                    </div>
                  </div>
                </div>

                {/* Capabilities */}
                {merchant.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {merchant.capabilities.map((cap, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Merchant Discovery</CardTitle>
          <CardDescription>How we find and track x402-enabled services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Automatic Discovery</h3>
            <p className="text-sm text-muted-foreground">
              Merchants are automatically discovered via facilitator Bazaar endpoints every 30 minutes.
              We query all active facilitators to find new services joining the network.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Real-Time Metrics</h3>
            <p className="text-sm text-muted-foreground">
              Success rates and call counts are tracked in real-time. Merchants with declining
              performance are flagged for investigation.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Verified Services</h3>
            <p className="text-sm text-muted-foreground">
              All merchants listed here are discoverable through verified x402 facilitators. Pricing
              is set by the merchant and enforced by the protocol.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
