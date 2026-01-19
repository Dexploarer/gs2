'use client'

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import {
  TrustScoreBadge,
  TrustScoreBar,
  TrustMetricsCard,
  type VerificationTier,
} from '@/components/observatory/trust-score-badge'
import { ENDPOINT_CATEGORIES } from '@/lib/x402/bazaar-sync'
import { Loader2, ExternalLink, RefreshCw, Search, Filter } from 'lucide-react'

// Network display mapping (available for future use)
const _NETWORK_LABELS: Record<string, string> = {
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana',
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'Solana Devnet',
  'eip155:8453': 'Base',
  'eip155:84532': 'Base Sepolia',
  solana: 'Solana',
  base: 'Base',
}

export default function EndpointsExplorerPage() {
  // Convex queries
  const endpoints = useQuery(api.endpoints.list, { limit: 100 })
  const syncStatus = useQuery(api.endpointSync.getSyncStatus, {})
  const leaderboard = useQuery(api.trustScoring.getLeaderboard, { limit: 10, minCalls: 0 })

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [protocolFilter, setProtocolFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [selectedEndpoint, setSelectedEndpoint] = useState<
    (typeof endpoints extends (infer T)[] | undefined ? T : never) | null
  >(null)

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return []

    return endpoints.filter((endpoint) => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase()
        const matchesSearch =
          endpoint.name.toLowerCase().includes(searchLower) ||
          endpoint.url.toLowerCase().includes(searchLower) ||
          endpoint.description?.toLowerCase().includes(searchLower) ||
          endpoint.capabilities?.some((c) => c.toLowerCase().includes(searchLower))

        if (!matchesSearch) return false
      }

      // Protocol filter
      if (protocolFilter !== 'all' && endpoint.protocol !== protocolFilter) {
        return false
      }

      // Category filter
      if (categoryFilter !== 'all' && endpoint.category !== categoryFilter) {
        return false
      }

      // Source filter
      if (sourceFilter !== 'all' && endpoint.source !== sourceFilter) {
        return false
      }

      return true
    })
  }, [endpoints, searchQuery, protocolFilter, categoryFilter, sourceFilter])

  // Select first endpoint by default
  useMemo(() => {
    if (!selectedEndpoint && filteredEndpoints.length > 0) {
      setSelectedEndpoint(filteredEndpoints[0])
    }
  }, [selectedEndpoint, filteredEndpoints])

  const isLoading = endpoints === undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Endpoint Directory</h1>
          <p className="text-muted-foreground">
            x402 endpoints with Ghost Score trust integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          <Button>Register Endpoint</Button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{syncStatus.total}</div>
              <p className="text-xs text-muted-foreground">Total Endpoints</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{syncStatus.verified}</div>
              <p className="text-xs text-muted-foreground">Verified</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">{syncStatus.bySource.bazaar}</div>
              <p className="text-xs text-muted-foreground">From Bazaar</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-purple-500">{syncStatus.bySource.payai}</div>
              <p className="text-xs text-muted-foreground">From PayAI</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-500">
                {syncStatus.recentlyUpdated}
              </div>
              <p className="text-xs text-muted-foreground">Updated (24h)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={protocolFilter} onValueChange={setProtocolFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Protocol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Protocols</SelectItem>
            <SelectItem value="x402">x402</SelectItem>
            <SelectItem value="http">HTTP</SelectItem>
            <SelectItem value="https">HTTPS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ENDPOINT_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="bazaar">Bazaar</SelectItem>
            <SelectItem value="payai">PayAI</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="crawl">Crawled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEndpoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No endpoints found</h3>
            <p className="text-muted-foreground">
              {searchQuery || protocolFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Endpoints will appear here once synced from Bazaar and PayAI'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Endpoint List */}
          <div className="lg:col-span-2 space-y-3">
            {filteredEndpoints.map((endpoint) => (
              <Card
                key={endpoint._id}
                className={`cursor-pointer transition-all ${
                  selectedEndpoint?._id === endpoint._id
                    ? 'ring-2 ring-primary border-primary'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedEndpoint(endpoint)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{endpoint.name}</h3>
                        {endpoint.isVerified && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {endpoint.url}
                      </p>
                    </div>
                    <TrustScoreBadge
                      score={endpoint.trustScore || 0}
                      tier={(endpoint.verificationTier as VerificationTier) || 'UNVERIFIED'}
                      size="sm"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Success</div>
                      <div className="font-semibold text-green-500">
                        {(endpoint.successRate || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Latency</div>
                      <div className="font-semibold">{endpoint.avgResponseTime || 0}ms</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Calls</div>
                      <div className="font-semibold">
                        {(endpoint.totalCalls || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Price</div>
                      <div className="font-semibold">${(endpoint.priceUSDC || 0).toFixed(4)}</div>
                    </div>
                  </div>

                  {endpoint.capabilities && endpoint.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {endpoint.capabilities.slice(0, 3).map((cap) => (
                        <Badge key={cap} variant="outline" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                      {endpoint.capabilities.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{endpoint.capabilities.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sidebar - Selected Endpoint Details */}
          <div className="space-y-4">
            {selectedEndpoint ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedEndpoint.name}</CardTitle>
                        <CardDescription className="font-mono text-xs break-all mt-1">
                          {selectedEndpoint.url}
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={selectedEndpoint.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Trust Score */}
                    <div>
                      <div className="text-sm font-medium mb-2">Trust Score</div>
                      <TrustScoreBar score={selectedEndpoint.trustScore || 0} />
                      <div className="mt-2">
                        <TrustScoreBadge
                          score={selectedEndpoint.trustScore || 0}
                          tier={
                            (selectedEndpoint.verificationTier as VerificationTier) || 'UNVERIFIED'
                          }
                          size="md"
                        />
                      </div>
                    </div>

                    {/* Metrics */}
                    <TrustMetricsCard
                      metrics={{
                        successRate: selectedEndpoint.successRate || 0,
                        avgResponseTime: selectedEndpoint.avgResponseTime || 0,
                        totalCalls: selectedEndpoint.totalCalls || 0,
                        consistencyScore: selectedEndpoint.consistencyScore,
                      }}
                    />

                    {/* Provider */}
                    {selectedEndpoint.agent && (
                      <div>
                        <div className="text-sm font-medium mb-2">Provider</div>
                        <div className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <div className="font-medium">{selectedEndpoint.agent.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {selectedEndpoint.agent.tier} tier
                            </div>
                          </div>
                          <GhostScoreBadge
                            score={selectedEndpoint.agent.ghostScore}
                            tier={selectedEndpoint.agent.tier as 'bronze' | 'silver' | 'gold' | 'platinum'}
                            showScore={true}
                          />
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Protocol</div>
                        <Badge variant="outline">{selectedEndpoint.protocol.toUpperCase()}</Badge>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Source</div>
                        <Badge variant="outline" className="capitalize">
                          {selectedEndpoint.source || 'Unknown'}
                        </Badge>
                      </div>
                      {selectedEndpoint.category && (
                        <div className="col-span-2">
                          <div className="text-xs text-muted-foreground">Category</div>
                          <Badge variant="secondary" className="capitalize">
                            {selectedEndpoint.category.replace('-', ' ')}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Capabilities */}
                    {selectedEndpoint.capabilities &&
                      selectedEndpoint.capabilities.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2">Capabilities</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedEndpoint.capabilities.map((cap) => (
                              <Badge key={cap} variant="secondary" className="text-xs">
                                {cap}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" size="sm">
                        Test Endpoint
                      </Button>
                      <Button variant="outline" size="sm">
                        View History
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Trust Leaderboard */}
                {leaderboard && leaderboard.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Top Trusted Endpoints</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {leaderboard.slice(0, 5).map((ep, i) => (
                        <div
                          key={ep.id}
                          className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2"
                          onClick={() => {
                            const found = endpoints?.find((e) => e._id === ep.id)
                            if (found) setSelectedEndpoint(found)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-4">{i + 1}.</span>
                            <span className="truncate max-w-[150px]">{ep.name}</span>
                          </div>
                          <span className="font-mono text-xs">{ep.trustScore}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Select an endpoint to view details
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
