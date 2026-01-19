'use client'

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format, formatDistanceToNow } from 'date-fns'

type Endpoint = NonNullable<ReturnType<typeof useQuery<typeof api.endpoints.list>>>[number]

export function DatabasePageClient() {
  // Fetch x402 endpoints from Convex
  const endpoints = useQuery(api.endpoints.list, { protocol: 'x402', limit: 100 })

  // Track selected endpoint
  const [selectedEndpointUrl, setSelectedEndpointUrl] = useState<string | null>(null)

  // Auto-select first endpoint when loaded
  const selectedEndpoint = useMemo(() => {
    if (!endpoints || endpoints.length === 0) return null
    const url = selectedEndpointUrl || endpoints[0]?.url
    return endpoints.find((e) => e.url === url) || endpoints[0]
  }, [endpoints, selectedEndpointUrl])

  // Fetch endpoint-specific stats when an endpoint is selected
  const endpointStats = useQuery(
    api.x402Payments.getEndpointStats,
    selectedEndpoint ? { endpoint: selectedEndpoint.url } : 'skip'
  )

  // Fetch call history for selected endpoint
  const callHistory = useQuery(
    api.x402Payments.getByEndpoint,
    selectedEndpoint ? { endpoint: selectedEndpoint.url, limit: 10 } : 'skip'
  )

  // Track active tab
  const [activeTab, setActiveTab] = useState<'header' | 'request' | 'response'>('header')

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')

  // Filter endpoints by search
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return []
    if (!searchQuery.trim()) return endpoints
    const query = searchQuery.toLowerCase()
    return endpoints.filter(
      (e) =>
        e.url.toLowerCase().includes(query) ||
        e.name.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query)
    )
  }, [endpoints, searchQuery])

  // Loading state
  if (endpoints === undefined) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading endpoints...</div>
      </div>
    )
  }

  // Empty state
  if (endpoints.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Card className="border-2 border-dashed max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-lg font-medium">No Endpoints Found</div>
            <p className="text-sm text-muted-foreground text-center">
              No x402 endpoints have been discovered yet. Endpoints are automatically
              discovered via facilitator sync jobs.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get URL path from full URL
  const getUrlPath = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.pathname
    } catch {
      return url
    }
  }

  // Get domain from URL
  const getDomain = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.hostname
    } catch {
      return 'Unknown'
    }
  }

  // Build x402 header object for display
  const build402Header = (endpoint: Endpoint) => ({
    type: 'http',
    accepts: [
      {
        asset: endpoint.network === 'base'
          ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
          : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        extra: {
          name: 'USD Coin',
          version: endpoint.network === 'base' ? '2' : '1',
        },
      },
    ],
    payTo: endpoint.agent?.address || 'unknown',
    scheme: 'exact',
    network: endpoint.network || 'solana',
    mimeType: 'application/json',
    resource: endpoint.url,
    description: `Payment for ${endpoint.name} ($${endpoint.priceUSDC.toFixed(2)})`,
  })

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Sidebar - Endpoints List */}
      <div className="w-80 border-r border-border bg-card/50 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="text-sm font-bold">DB</span>
            </div>
            <h2 className="font-semibold">Database</h2>
          </div>

          <input
            type="search"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background"
          />
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div className="space-y-1">
            {filteredEndpoints.map((endpoint) => (
              <button
                key={endpoint._id}
                onClick={() => setSelectedEndpointUrl(endpoint.url)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedEndpoint?.url === endpoint.url
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-xs ${endpoint.successRate >= 90 ? 'text-green-500' : endpoint.successRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {endpoint.successRate >= 90 ? '✓' : endpoint.successRate >= 50 ? '!' : '✗'}
                    </span>
                    <span className="truncate font-mono text-xs">{getUrlPath(endpoint.url)}</span>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {endpoint.successRate.toFixed(0)}%
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {getDomain(endpoint.url)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full" disabled>
            Test with Agents
          </Button>
        </div>
      </div>

      {/* Main Content - API Details */}
      {selectedEndpoint && (
        <div className="flex-1 flex flex-col bg-background">
          {/* Header with endpoint info */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <Badge
                variant="outline"
                className={`text-xs ${
                  selectedEndpoint.successRate >= 90
                    ? 'border-green-500 text-green-500'
                    : selectedEndpoint.successRate >= 50
                    ? 'border-yellow-500 text-yellow-500'
                    : 'border-red-500 text-red-500'
                }`}
              >
                {selectedEndpoint.successRate >= 90 ? 'WORKING' : selectedEndpoint.successRate >= 50 ? 'DEGRADED' : 'FAILING'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {selectedEndpoint.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
              </Badge>
              <Badge className="text-xs">
                {selectedEndpoint.protocol.toUpperCase()}
              </Badge>
              <span className="text-sm font-mono text-muted-foreground truncate">
                {selectedEndpoint.url}
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">CALLS </span>
                <span className="font-semibold">{selectedEndpoint.totalCalls.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">RATE </span>
                <span className={`font-semibold ${selectedEndpoint.successRate >= 90 ? 'text-green-500' : selectedEndpoint.successRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {selectedEndpoint.successRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">PRICE </span>
                <span className="font-semibold">${selectedEndpoint.priceUSDC.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 p-4">
            <Card className="bg-green-950/20 border-green-900/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs text-green-400">SUCCESS</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-400">
                  {endpointStats?.successCount ?? selectedEndpoint.successfulCalls}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-950/20 border-red-900/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs text-red-400">FAILED</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-red-400">
                  {endpointStats?.failedCount ?? selectedEndpoint.failedCalls}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">MAX PRICE</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(endpointStats?.maxPrice ?? selectedEndpoint.priceUSDC).toFixed(4)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">AVG RESPONSE</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedEndpoint.avgResponseTime.toFixed(0)}ms
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="border-b border-border px-4">
            <div className="flex gap-1">
              {(['header', 'request', 'response'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'header' && '402 Header'}
                  {tab === 'request' && 'Request'}
                  {tab === 'response' && 'Response'}
                </button>
              ))}
            </div>
          </div>

          {/* JSON Display */}
          <div className="flex-1 overflow-auto p-4">
            <pre className="text-xs font-mono bg-card p-4 rounded-lg border border-border overflow-auto">
              {activeTab === 'header' && JSON.stringify(build402Header(selectedEndpoint), null, 2)}
              {activeTab === 'request' && JSON.stringify({
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-402-Payment': '<payment-token>',
                },
                body: {
                  note: 'Request body varies by endpoint',
                  capabilities: selectedEndpoint.capabilities,
                },
              }, null, 2)}
              {activeTab === 'response' && JSON.stringify({
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                },
                body: {
                  success: true,
                  data: '...',
                  note: 'Response format varies by endpoint',
                },
              }, null, 2)}
            </pre>
          </div>

          {/* API Call History */}
          <div className="border-t border-border p-4">
            <div className="text-xs text-muted-foreground mb-3">API Call History</div>
            <div className="space-y-2">
              {callHistory === undefined ? (
                <div className="text-xs text-muted-foreground">Loading history...</div>
              ) : callHistory.length === 0 ? (
                <div className="text-xs text-muted-foreground">No call history yet</div>
              ) : (
                callHistory.slice(0, 3).map((call) => (
                  <div
                    key={call._id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                        call.status === 'completed'
                          ? 'bg-green-950/50 text-green-400'
                          : call.status === 'failed'
                          ? 'bg-red-950/50 text-red-400'
                          : 'bg-yellow-950/50 text-yellow-400'
                      }`}
                    >
                      {call.status === 'completed' ? '200' : call.status === 'failed' ? '4xx' : '...'}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(call.timestamp, { addSuffix: true })}
                    </span>
                    <span className="text-xs ml-auto">
                      ${call.amount.toFixed(4)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar - Details */}
      {selectedEndpoint && (
        <div className="w-80 border-l border-border bg-card/50 p-4 space-y-6">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">TITLE</div>
            <div className="text-sm">{selectedEndpoint.name}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">DESCRIPTION</div>
            <div className="text-sm text-muted-foreground">{selectedEndpoint.description}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">PROTOCOL</div>
            <Badge variant="secondary">{selectedEndpoint.protocol}</Badge>
          </div>

          {selectedEndpoint.network && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">NETWORK</div>
              <Badge variant="outline">{selectedEndpoint.network}</Badge>
            </div>
          )}

          {selectedEndpoint.capabilities.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">CAPABILITIES</div>
              <div className="flex flex-wrap gap-1">
                {selectedEndpoint.capabilities.map((cap, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">TIMELINE</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">First seen</div>
                <div className="text-sm">
                  {format(selectedEndpoint.createdAt, 'MMM d, yyyy')}
                </div>
              </div>
              {endpointStats?.lastSuccessAt && (
                <div>
                  <div className="text-xs text-green-400">Last success</div>
                  <div className="text-sm">
                    {formatDistanceToNow(endpointStats.lastSuccessAt, { addSuffix: true })}
                  </div>
                </div>
              )}
              {endpointStats?.lastFailureAt && (
                <div>
                  <div className="text-xs text-red-400">Last failure</div>
                  <div className="text-sm">
                    {formatDistanceToNow(endpointStats.lastFailureAt, { addSuffix: true })}
                  </div>
                </div>
              )}
              {selectedEndpoint.lastTested && (
                <div>
                  <div className="text-xs text-muted-foreground">Last tested</div>
                  <div className="text-sm">
                    {formatDistanceToNow(selectedEndpoint.lastTested, { addSuffix: true })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedEndpoint.agent && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">PROVIDER</div>
              <div className="text-sm font-medium">{selectedEndpoint.agent.name}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                {selectedEndpoint.agent.address}
              </div>
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  Ghost Score: {selectedEndpoint.agent.ghostScore}
                </Badge>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
