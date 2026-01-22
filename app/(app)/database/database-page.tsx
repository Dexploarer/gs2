'use client'

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { format, formatDistanceToNow } from 'date-fns'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { Search, Database } from 'lucide-react'

// Define Endpoint type manually since we can't infer easily from client
interface Endpoint {
  _id: string
  url: string
  name: string
  description: string
  protocol: string
  network?: string
  successRate: number
  priceUSDC: number
  isVerified: boolean
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  avgResponseTime: number
  capabilities: string[]
  createdAt: number
  lastTested?: number
  agent?: {
    address: string
    name: string
    ghostScore: number
  }
}

export function DatabasePageClient() {
  const endpoints = useQuery(api.endpoints.list, { protocol: 'x402', limit: 100 }) as Endpoint[] | undefined
  const [selectedEndpointUrl, setSelectedEndpointUrl] = useState<string | null>(null)

  // Stats queries
  const selectedEndpoint = useMemo(() => {
    if (!endpoints || endpoints.length === 0) return null
    const url = selectedEndpointUrl || endpoints[0]?.url
    return endpoints.find((e) => e.url === url) || endpoints[0]
  }, [endpoints, selectedEndpointUrl])

  const endpointStats = useQuery(
    api.x402Payments.getEndpointStats,
    selectedEndpoint ? { endpoint: selectedEndpoint.url } : 'skip'
  )

  const callHistory = useQuery(
    api.x402Payments.getByEndpoint,
    selectedEndpoint ? { endpoint: selectedEndpoint.url, limit: 10 } : 'skip'
  )

  const [activeTab, setActiveTab] = useState<'header' | 'request' | 'response'>('header')
  const [searchQuery, setSearchQuery] = useState('')

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

  // Helper functions
  const getUrlPath = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.pathname
    } catch { return url }
  }

  const getDomain = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.hostname
    } catch { return 'Unknown' }
  }

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

  // Loading state
  if (endpoints === undefined) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-muted-foreground font-mono animate-pulse">LOADING DATABASE...</div>
      </div>
    )
  }

  // Empty state
  if (endpoints.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="p-12 border border-dashed border-border rounded-xl text-center max-w-md">
          <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-foreground font-bold mb-2">No Endpoints Found</h3>
          <p className="text-muted-foreground text-sm">
            No x402 endpoints found. Sync jobs typically run every 10 minutes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex border border-border rounded-xl overflow-hidden bg-card">
      {/* Sidebar List */}
      <div className="w-80 border-r border-border flex flex-col bg-muted">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-subtle rounded flex items-center justify-center text-muted-foreground">
              <Database className="w-3 h-3" />
            </div>
            <h2 className="text-sm font-mono font-bold text-foreground uppercase tracking-wider">Database Explorer</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-subtle border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-border/70 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredEndpoints.map((endpoint) => (
            <button
              key={endpoint._id}
              onClick={() => setSelectedEndpointUrl(endpoint.url)}
              className={`w-full text-left px-3 py-3 rounded-lg border transition-all group ${selectedEndpoint?.url === endpoint.url
                  ? 'bg-subtle border-border shadow-inner'
                  : 'bg-transparent border-transparent hover:bg-subtle hover:border-border/70'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${endpoint.successRate >= 90 ? 'bg-green-500/10 text-green-400' :
                    endpoint.successRate >= 50 ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-red-500/10 text-red-400'
                  }`}>
                  {endpoint.successRate >= 90 ? 'OK' : 'ERR'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {endpoint.totalCalls} calls
                </span>
              </div>
              <div className="font-mono text-xs text-foreground truncate mb-1 opacity-80 group-hover:opacity-100">
                {getUrlPath(endpoint.url)}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {getDomain(endpoint.url)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      {selectedEndpoint && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main Header */}
          <div className="p-6 border-b border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl font-mono font-bold text-foreground break-all">
                    {selectedEndpoint.name}
                  </h1>
                  {selectedEndpoint.isVerified && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Verified" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground font-mono break-all">
                  {selectedEndpoint.url}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-bold text-foreground">
                  ${selectedEndpoint.priceUSDC.toFixed(4)}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Price per call</div>
              </div>
            </div>

            <StatGrid columns={4} className="mb-0">
              <StatCard
                label="Success Rate"
                value={`${selectedEndpoint.successRate.toFixed(1)}%`}
                trend={{
                  value: selectedEndpoint.successRate >= 98 ? 'Healthy' : 'Degraded',
                  direction: selectedEndpoint.successRate >= 98 ? 'up' : 'down'
                }}
              />
              <StatCard
                label="Avg Latency"
                value={`${(selectedEndpoint.avgResponseTime).toFixed(0)}ms`}
                subtext="P95 Response"
              />
              <StatCard
                label="Total Success"
                value={endpointStats?.successCount ?? selectedEndpoint.successfulCalls}
                trend={{
                  value: 'calls',
                  direction: 'neutral'
                }}
              />
              <StatCard
                label="Failures"
                value={endpointStats?.failedCount ?? selectedEndpoint.failedCalls}
                trend={{
                  value: 'calls',
                  direction: 'down'
                }}
              />
            </StatGrid>
          </div>

          {/* Technical Details Tabs */}
          <div className="flex-1 flex flex-col min-h-0 bg-muted">
            <div className="border-b border-border px-6">
              <div className="flex gap-6">
                {(['header', 'request', 'response'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {tab === 'header' && 'x402 Header'}
                    {tab === 'request' && 'Sample Request'}
                    {tab === 'response' && 'Sample Response'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="bg-subtle border border-border rounded-xl p-4 overflow-x-auto">
                <pre className="text-xs font-mono text-muted-foreground">
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
            </div>

            {/* Recent Calls Footer */}
            <div className="border-t border-border p-6 bg-card">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Recent Calls</h3>
              <div className="space-y-2">
                {callHistory === undefined ? (
                  <div className="text-xs text-muted-foreground">Loading history...</div>
                ) : callHistory.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No recent calls recorded</div>
                ) : (
                  callHistory.slice(0, 3).map((call) => (
                    <div key={call._id} className="flex items-center justify-between p-2 rounded bg-subtle border border-border">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-mono px-1 rounded ${call.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                          {call.status === 'completed' ? '200' : 'ERR'}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatDistanceToNow(call.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-foreground">
                        ${call.amount.toFixed(4)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right Details Sidebar */}
      {selectedEndpoint && (
        <div className="w-72 border-l border-border bg-muted p-6 overflow-y-auto hidden xl:block">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-6">Metadata</h3>

          <div className="space-y-6">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Provider</div>
              <div className="text-sm font-bold text-foreground mb-0.5">{selectedEndpoint.agent?.name || 'Unknown'}</div>
              <div className="text-xs font-mono text-muted-foreground truncate">{selectedEndpoint.agent?.address}</div>
            </div>

            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Network</div>
              <span className="inline-block px-2 py-0.5 rounded bg-subtle border border-border text-xs text-primary font-mono">
                {selectedEndpoint.network || 'Solana'}
              </span>
            </div>

            {selectedEndpoint.capabilities.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Capabilities</div>
                <div className="flex flex-wrap gap-1">
                  {selectedEndpoint.capabilities.map((cap) => (
                    <span key={cap} className="px-2 py-0.5 rounded bg-subtle text-[10px] text-muted-foreground border border-border">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-border">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Timeline</div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">First Seen</span>
                  <span className="font-mono text-muted-foreground">{format(selectedEndpoint.createdAt, 'MMM d')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last Success</span>
                  <span className="font-mono text-primary">
                    {endpointStats?.lastSuccessAt
                      ? formatDistanceToNow(endpointStats.lastSuccessAt)
                      : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
