'use client'

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { Search } from 'lucide-react'

// Mock data for network names (keep existing map)
const networkNames: Record<string, string> = {
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana',
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'Solana Devnet',
  'eip155:8453': 'Base',
  'eip155:84532': 'Base Sepolia',
  solana: 'Solana',
  base: 'Base',
}

export default function EndpointsExplorerPage() {
  const [search, setSearch] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null)

  // Fetch data
  const endpoints = useQuery(api.endpoints.list, {})
  const stats = useQuery(api.agentActivity.getStats, { limit: 100 })

  // Calculate endpoint stats
  const endpointStats = useMemo(() => {
    if (!endpoints || !stats) return null

    const totalCalls = stats.totalCalls || 0
    const uniqueEndpoints = endpoints.length
    const mostActiveEndpoint = endpoints.length > 0 ? endpoints[0].url : 'None'

    // Group by network
    const networkCounts: Record<string, number> = {}
    endpoints.forEach((ep) => {
      const net = ep.network || 'unknown'
      networkCounts[net] = (networkCounts[net] || 0) + 1
    })

    return {
      totalCalls,
      uniqueEndpoints,
      mostActiveEndpoint,
      networkCounts,
    }
  }, [endpoints, stats])

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return []

    return endpoints.filter((endpoint) => {
      const matchesSearch =
        endpoint.url.toLowerCase().includes(search.toLowerCase()) ||
        endpoint.description?.toLowerCase().includes(search.toLowerCase()) ||
        (endpoint.agent?.name || '').toLowerCase().includes(search.toLowerCase())

      const matchesNetwork = selectedNetwork ? endpoint.network === selectedNetwork : true

      return matchesSearch && matchesNetwork
    })
  }, [endpoints, search, selectedNetwork])

  // Get unique networks for filter
  const networks = useMemo(() => {
    if (!endpoints) return []
    const nets = new Set(endpoints.map((e) => e.network || 'unknown'))
    return Array.from(nets)
  }, [endpoints])

  if (endpoints === undefined || stats === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Endpoint Explorer</h1>
          <p className="text-muted-foreground">Loading endpoint registry...</p>
        </div>
        <StatGrid columns={3}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 bg-card border border-border rounded-xl animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-3" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </StatGrid>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Endpoint Explorer</h1>
        <p className="text-muted-foreground">
          Registry of active API endpoints served by agents
        </p>
      </div>

      {/* Stats Grid */}
      <StatGrid columns={3}>
        <StatCard
          label="Active Endpoints"
          value={endpointStats?.uniqueEndpoints || 0}
          subtext="Total unique endpoints"
          trend={{ value: '+12%', direction: 'up' }}
        />
        <StatCard
          label="Total Calls"
          value={(endpointStats?.totalCalls || 0).toLocaleString()}
          subtext="Lifetime requests"
          trend={{ value: '24h', direction: 'neutral' }}
        />
        <StatCard
          label="Networks"
          value={Object.keys(endpointStats?.networkCounts || {}).length}
          subtext="Supported chains"
        />
      </StatGrid>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search endpoints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedNetwork(null)}
            className={`px-3 py-2 text-xs font-mono rounded whitespace-nowrap transition-colors border ${selectedNetwork === null
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
              }`}
          >
            All Networks
          </button>
          {networks.map((net) => (
            <button
              key={net}
              onClick={() => setSelectedNetwork(net)}
              className={`px-3 py-2 text-xs font-mono rounded whitespace-nowrap transition-colors border ${selectedNetwork === net
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                }`}
            >
              {networkNames[net] || net}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="status-pulse w-2 h-2" />
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Active Endpoints
            {filteredEndpoints.length !== endpoints.length && ` (${filteredEndpoints.length})`}
          </h2>
        </div>

        {filteredEndpoints.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
            No endpoints found matching your criteria
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEndpoints.map((endpoint) => (
              <div
                key={endpoint._id}
                className="group p-4 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${endpoint.protocol === 'x402' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        endpoint.protocol === 'https' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                        {endpoint.protocol.toUpperCase()}
                      </span>
                      <h3 className="font-mono text-foreground text-sm truncate group-hover:text-primary transition-colors">
                        {endpoint.url}
                      </h3>
                    </div>
                    {endpoint.description && (
                      <p className="text-muted-foreground text-sm mb-3 max-w-2xl">
                        {endpoint.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                      <span>Agent: {endpoint.agent?.name || endpoint.agentId?.slice(0, 8)}</span>
                      <span>Success: {endpoint.successRate}%</span>
                      <span>
                        Net: <span className="text-primary">{networkNames[endpoint.network || ''] || endpoint.network}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-6">
                    <div className="text-center">
                      <div className="text-sm font-mono font-bold text-foreground">
                        {endpoint.avgResponseTime ? `${Math.round(endpoint.avgResponseTime)}ms` : '-'}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">Latency</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-mono font-bold text-foreground">
                        {endpoint.priceUSDC ? `$${endpoint.priceUSDC}` : 'Free'}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">Cost</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
