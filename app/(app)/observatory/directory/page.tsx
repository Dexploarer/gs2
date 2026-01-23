'use client'

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, ExternalLink, CheckCircle, Zap, Database, Brain, Shield, Code, Coins, LayoutGrid } from 'lucide-react'
import Link from 'next/link'

// Category definitions with icons
const CATEGORIES = [
  { id: 'ai', name: 'AI & ML', icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
  { id: 'data', name: 'Data & Analytics', icon: Database, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  { id: 'defi', name: 'DeFi & Trading', icon: Coins, color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' },
  { id: 'compute', name: 'Compute', icon: Zap, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' },
  { id: 'storage', name: 'Storage', icon: LayoutGrid, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/20' },
  { id: 'security', name: 'Security', icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
  { id: 'tools', name: 'Dev Tools', icon: Code, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' },
]

const NETWORKS = [
  { id: 'solana', name: 'Solana', color: 'text-purple-400' },
  { id: 'base', name: 'Base', color: 'text-blue-400' },
  { id: 'polygon', name: 'Polygon', color: 'text-violet-400' },
]

const PRICE_RANGES = [
  { id: 'free', name: 'Free', min: 0, max: 0 },
  { id: 'micro', name: '$0.001', min: 0, max: 0.001 },
  { id: 'low', name: '$0.01', min: 0.001, max: 0.01 },
  { id: 'medium', name: '$0.10', min: 0.01, max: 0.1 },
  { id: 'high', name: '$0.10+', min: 0.1, max: Infinity },
]

function getTrustTier(score: number | undefined): { name: string; color: string } {
  if (!score) return { name: 'Unverified', color: 'text-gray-400' }
  if (score >= 800) return { name: 'Certified', color: 'text-green-400' }
  if (score >= 600) return { name: 'Trusted', color: 'text-blue-400' }
  if (score >= 400) return { name: 'Verified', color: 'text-yellow-400' }
  if (score >= 200) return { name: 'Tested', color: 'text-orange-400' }
  return { name: 'Unverified', color: 'text-gray-400' }
}

export default function ServiceDirectoryPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null)
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Fetch data
  const endpoints = useQuery(api.endpoints.list, { limit: 500 })
  const stats = useQuery(api.endpoints.getStats, {})
  const topProviders = useQuery(api.endpoints.getTopProviders, { limit: 10 })

  // Filter endpoints
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return []

    return endpoints.filter((endpoint) => {
      // Search filter
      const matchesSearch =
        !search ||
        endpoint.name.toLowerCase().includes(search.toLowerCase()) ||
        endpoint.description?.toLowerCase().includes(search.toLowerCase()) ||
        endpoint.url.toLowerCase().includes(search.toLowerCase()) ||
        endpoint.capabilities?.some((c) => c.toLowerCase().includes(search.toLowerCase()))

      // Category filter
      const matchesCategory = !selectedCategory || endpoint.category === selectedCategory

      // Network filter
      const matchesNetwork = !selectedNetwork || endpoint.network === selectedNetwork

      // Price filter
      let matchesPrice = true
      if (selectedPriceRange) {
        const range = PRICE_RANGES.find((r) => r.id === selectedPriceRange)
        if (range) {
          if (range.id === 'free') {
            matchesPrice = endpoint.priceUSDC === 0
          } else if (range.id === 'high') {
            matchesPrice = endpoint.priceUSDC > 0.1
          } else {
            matchesPrice = endpoint.priceUSDC > range.min && endpoint.priceUSDC <= range.max
          }
        }
      }

      return matchesSearch && matchesCategory && matchesNetwork && matchesPrice
    })
  }, [endpoints, search, selectedCategory, selectedNetwork, selectedPriceRange])

  // Loading state
  if (endpoints === undefined || stats === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Service Directory</h1>
          <p className="text-muted-foreground">Loading x402 service registry...</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 bg-card border border-border rounded-xl animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-3" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Service Directory</h1>
          <p className="text-muted-foreground">
            Discover and integrate with {stats.totalEndpoints.toLocaleString()} x402-enabled APIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
            Live Data
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Services"
          value={stats.totalEndpoints.toLocaleString()}
          subtext={`${stats.x402Endpoints} x402-native`}
          trend={{ value: '+12%', direction: 'up' }}
        />
        <StatCard
          label="Verified"
          value={stats.verifiedEndpoints.toLocaleString()}
          subtext={`${((stats.verifiedEndpoints / stats.totalEndpoints) * 100).toFixed(1)}% of total`}
          trend={{ value: 'Trust scored', direction: 'neutral' }}
        />
        <StatCard
          label="Total Calls"
          value={
            stats.totalCalls >= 1_000_000
              ? `${(stats.totalCalls / 1_000_000).toFixed(1)}M`
              : stats.totalCalls.toLocaleString()
          }
          subtext="Lifetime transactions"
        />
        <StatCard
          label="Avg Success"
          value={`${stats.avgSuccessRate.toFixed(1)}%`}
          subtext="Platform reliability"
          trend={{ value: stats.avgSuccessRate > 95 ? 'Excellent' : 'Good', direction: 'up' }}
        />
      </StatGrid>

      {/* Category Cards */}
      <div>
        <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-4">
          Browse by Category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const catStats = stats.categoryStats[cat.id]
            const isSelected = selectedCategory === cat.id

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                className={`p-4 rounded-xl border transition-all text-left ${
                  isSelected
                    ? `${cat.bgColor} ${cat.borderColor} border-2`
                    : 'bg-card border-border hover:border-primary/30'
                }`}
              >
                <Icon className={`h-5 w-5 ${cat.color} mb-2`} />
                <div className="font-medium text-foreground text-sm">{cat.name}</div>
                <div className="text-xs text-muted-foreground">
                  {catStats?.count || 0} services
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search services, APIs, capabilities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
            showFilters || selectedNetwork || selectedPriceRange
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-card text-muted-foreground border-border hover:text-foreground'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span className="text-sm">Filters</span>
          {(selectedNetwork || selectedPriceRange) && (
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {(selectedNetwork ? 1 : 0) + (selectedPriceRange ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Expandable Filters */}
      {showFilters && (
        <div className="p-4 bg-card border border-border rounded-xl space-y-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Network</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedNetwork(null)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  !selectedNetwork
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                All Networks
              </button>
              {NETWORKS.map((net) => (
                <button
                  key={net.id}
                  onClick={() => setSelectedNetwork(selectedNetwork === net.id ? null : net.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    selectedNetwork === net.id
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  {net.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Price Range</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedPriceRange(null)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  !selectedPriceRange
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                Any Price
              </button>
              {PRICE_RANGES.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setSelectedPriceRange(selectedPriceRange === range.id ? null : range.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    selectedPriceRange === range.id
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  {range.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Services List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="status-pulse w-2 h-2" />
              <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                {filteredEndpoints.length} Services
              </h2>
            </div>
            {(selectedCategory || selectedNetwork || selectedPriceRange || search) && (
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  setSelectedNetwork(null)
                  setSelectedPriceRange(null)
                  setSearch('')
                }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>

          {filteredEndpoints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
              No services found matching your criteria
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEndpoints.slice(0, 50).map((endpoint) => {
                const trustTier = getTrustTier(endpoint.trustScore)
                const category = CATEGORIES.find((c) => c.id === endpoint.category)

                return (
                  <div
                    key={endpoint._id}
                    className="group p-5 bg-card border border-border rounded-xl hover:border-primary/30 transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          {/* Protocol Badge */}
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                              endpoint.protocol === 'x402'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : endpoint.protocol === 'https'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}
                          >
                            {endpoint.protocol.toUpperCase()}
                          </span>
                          {/* Verified Badge */}
                          {endpoint.isVerified && (
                            <span className="flex items-center gap-1 text-[10px] text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                          {/* Category */}
                          {category && (
                            <span className={`text-[10px] ${category.color}`}>
                              {category.name}
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                          {endpoint.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {endpoint.description}
                        </p>

                        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                          <span className="truncate max-w-[200px]">{endpoint.url}</span>
                          {endpoint.agent && (
                            <Link
                              href={`/observatory/agents/${endpoint.agent.address}`}
                              className="hover:text-primary transition-colors"
                            >
                              by {endpoint.agent.name}
                            </Link>
                          )}
                        </div>

                        {/* Capabilities */}
                        {endpoint.capabilities && endpoint.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {endpoint.capabilities.slice(0, 4).map((cap) => (
                              <span
                                key={cap}
                                className="px-2 py-0.5 text-[10px] bg-muted text-muted-foreground rounded"
                              >
                                {cap}
                              </span>
                            ))}
                            {endpoint.capabilities.length > 4 && (
                              <span className="px-2 py-0.5 text-[10px] text-muted-foreground">
                                +{endpoint.capabilities.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex lg:flex-col items-center lg:items-end gap-4 lg:gap-2 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6">
                        <div className="text-right">
                          <div className="text-lg font-mono font-bold text-foreground">
                            {endpoint.priceUSDC === 0 ? 'Free' : `$${endpoint.priceUSDC}`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">per call</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-foreground">
                            {endpoint.successRate.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">success</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-mono ${trustTier.color}`}>
                            {trustTier.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">trust tier</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredEndpoints.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Showing 50 of {filteredEndpoints.length} services
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Top Providers */}
          <div className="p-5 bg-card border border-border rounded-xl">
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Top Providers
            </h3>
            <div className="space-y-3">
              {topProviders?.slice(0, 8).map((provider, index) => (
                <div key={provider.agentId} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {provider.agent?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {provider.endpointCount} services • {provider.totalCalls.toLocaleString()} calls
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Distribution */}
          <div className="p-5 bg-card border border-border rounded-xl">
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Networks
            </h3>
            <div className="space-y-3">
              {Object.entries(stats.networkStats).map(([network, data]) => {
                const netInfo = NETWORKS.find((n) => n.id === network)
                const percentage = (data.count / stats.totalEndpoints) * 100

                return (
                  <div key={network}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={netInfo?.color || 'text-foreground'}>
                        {netInfo?.name || network}
                      </span>
                      <span className="text-muted-foreground">{data.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Price Distribution */}
          <div className="p-5 bg-card border border-border rounded-xl">
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-4">
              Pricing
            </h3>
            <div className="space-y-2">
              {PRICE_RANGES.map((range) => {
                const count = stats.priceRanges[range.id as keyof typeof stats.priceRanges] || 0
                const percentage = (count / stats.totalEndpoints) * 100

                return (
                  <div key={range.id} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-muted-foreground">{range.name}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500/60 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs text-muted-foreground text-right">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Integration CTA */}
          <div className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl">
            <h3 className="font-semibold text-foreground mb-2">Build with x402</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Integrate pay-per-use APIs into your AI agents with our SDK.
            </p>
            <a
              href="https://github.com/anthropics/x402"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              View Documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
