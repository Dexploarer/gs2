'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FacilitatorComparison } from '@/components/observatory/facilitator-comparison'

export default function FacilitatorsPage() {
  // Fetch stats from Convex
  const stats = useQuery(api.facilitators.getStats, {})

  // Loading state
  if (stats === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">x402 Facilitators</h1>
          <p className="text-muted-foreground">Loading facilitator data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">x402 Facilitators</h1>
        <p className="text-muted-foreground">
          Complete registry of x402 payment facilitators supporting Solana and other networks
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Facilitators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.active}</div>
            <div className="text-sm text-muted-foreground mt-1">
              of {stats.total} total ({stats.verified} verified)
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Daily Volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${stats.totalDailyVolume >= 1_000_000
                ? `${(stats.totalDailyVolume / 1_000_000).toFixed(1)}M`
                : `${(stats.totalDailyVolume / 1000).toFixed(0)}K`}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              Across all facilitators
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Daily Transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.totalDailyTransactions >= 1_000_000
                ? `${(stats.totalDailyTransactions / 1_000_000).toFixed(1)}M`
                : `${(stats.totalDailyTransactions / 1000).toFixed(0)}K`}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Combined throughput</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Network Uptime</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.avgUptime.toFixed(2)}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stats.networkCoverage} networks covered
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facilitator Comparison */}
      <div>
        <h2 className="text-2xl font-bold mb-4">All Facilitators</h2>
        <FacilitatorComparison />
      </div>

      {/* Integration Info */}
      <Card>
        <CardHeader>
          <CardTitle>How to Choose a Facilitator</CardTitle>
          <CardDescription>Key considerations for selecting your x402 facilitator</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">For High-Volume Applications</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Choose <strong>PayAI</strong> or <strong>Coinbase CDP</strong> for proven
                scalability and lowest fees
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>PayAI: Solana-first, 99.9% uptime, fast settlement</li>
                <li>CDP: Enterprise-grade, fee-free USDC on Base</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">For Developer Experience</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Choose <strong>Rapid402</strong> or <strong>Thirdweb</strong> for best SDKs and
                documentation
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>Rapid402: Low-latency, streaming payments</li>
                <li>Thirdweb: Extensive SDK, embedded wallets</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">For Dispute Resolution</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Choose <strong>KAMIYO</strong> for escrow and oracle-powered disputes
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>Escrow-based payments for high-value transactions</li>
                <li>Oracle verification for AI output quality</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">For 8004 Identity</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Choose <strong>SATI</strong> for ERC-8004 compatible identity on Solana
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>Token-2022 based identity registry</li>
                <li>Solana Attestation Service integration</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
