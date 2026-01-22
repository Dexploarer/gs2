'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { FacilitatorComparison } from '@/components/observatory/facilitator-comparison'

export default function FacilitatorsPage() {
  const stats = useQuery(api.facilitators.getStats, {})

  if (stats === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">x402 Facilitators</h1>
          <p className="text-muted-foreground">Loading facilitator data...</p>
        </div>
        <StatGrid columns={4}>
          {[1, 2, 3, 4].map((i) => (
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
        <h1 className="text-2xl font-mono font-bold text-foreground mb-2">x402 Facilitators</h1>
        <p className="text-muted-foreground">
          Payment facilitators supporting Solana and other networks
        </p>
      </div>

      {/* Stats Grid */}
      <StatGrid columns={4}>
        <StatCard
          label="Active Facilitators"
          value={stats.active}
          subtext={`of ${stats.total} total (${stats.verified} verified)`}
        />
        <StatCard
          label="Daily Volume"
          value={stats.totalDailyVolume >= 1_000_000
            ? `$${(stats.totalDailyVolume / 1_000_000).toFixed(1)}M`
            : `$${(stats.totalDailyVolume / 1000).toFixed(0)}K`}
          trend={{ value: 'Across all', direction: 'neutral' }}
        />
        <StatCard
          label="Daily Transactions"
          value={stats.totalDailyTransactions >= 1_000_000
            ? `${(stats.totalDailyTransactions / 1_000_000).toFixed(1)}M`
            : `${(stats.totalDailyTransactions / 1000).toFixed(0)}K`}
        />
        <StatCard
          label="Avg Uptime"
          value={`${stats.avgUptime.toFixed(2)}%`}
          subtext={`${stats.networkCoverage} networks covered`}
          trend={{ value: stats.avgUptime > 99 ? 'Excellent' : 'Good', direction: stats.avgUptime > 99 ? 'up' : 'neutral' }}
        />
      </StatGrid>

      {/* Facilitator Comparison */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="status-pulse w-2 h-2" />
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">All Facilitators</h2>
        </div>
        <FacilitatorComparison />
      </div>

      {/* Integration Info */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <h3 className="text-foreground font-semibold mb-4">Choosing a Facilitator</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm text-[#ccff00] font-mono mb-2">HIGH-VOLUME</h4>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">PayAI</strong> or <strong className="text-foreground">Coinbase CDP</strong> for proven scalability and lowest fees.
            </p>
          </div>
          <div>
            <h4 className="text-sm text-blue-400 font-mono mb-2">DEVELOPER EXPERIENCE</h4>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Rapid402</strong> or <strong className="text-foreground">Thirdweb</strong> for best SDKs and documentation.
            </p>
          </div>
          <div>
            <h4 className="text-sm text-purple-400 font-mono mb-2">DISPUTE RESOLUTION</h4>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">KAMIYO</strong> for escrow and oracle-powered disputes.
            </p>
          </div>
          <div>
            <h4 className="text-sm text-green-400 font-mono mb-2">8004 IDENTITY</h4>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">SATI</strong> for ERC-8004 compatible identity on Solana.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
