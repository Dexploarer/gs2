'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { formatDistanceToNow } from 'date-fns'

interface PaymentStats {
  total?: number
  totalVolume?: number
  avgAmount?: number
}

interface RecentPayment {
  _id: string
  amount?: number
  network?: string
  from?: string
  agent?: {
    name?: string
  }
  agentId?: string
  txSignature?: string
  signature?: string
  _creationTime: number
}

export default function PaymentAnalyticsPage() {
  // Cast stats to expected type or handle any
  const stats = useQuery(api.x402Payments.getStats, {}) as PaymentStats | undefined
  const recentPayments = useQuery(api.x402Payments.getRecent, { limit: 20 }) as RecentPayment[] | undefined

  if (stats === undefined || recentPayments === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Payment Analytics</h1>
          <p className="text-muted-foreground">Loading payment data...</p>
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

  // Safe stats access
  const totalVolume = stats?.totalVolume || 0
  const totalTx = stats?.total || 0
  // avgAmount might not exist in stats, calculate if needed or use 0
  const avgAmount = stats?.avgAmount || (totalTx > 0 ? totalVolume / totalTx : 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Payment Analytics</h1>
        <p className="text-muted-foreground">
          Real-time x402 payment stream (XPS) analysis
        </p>
      </div>

      {/* Stats Grid */}
      <StatGrid columns={3}>
        <StatCard
          label="Total Volume"
          value={`$${totalVolume >= 1_000_000
            ? (totalVolume / 1_000_000).toFixed(2) + 'M'
            : totalVolume.toLocaleString()}`}
          subtext="Lifetime value"
        />
        <StatCard
          label="Transactions"
          value={totalTx.toLocaleString()}
          subtext="Total payments"
          trend={{ value: '24h activity', direction: 'neutral' }}
        />
        <StatCard
          label="Avg Payment"
          value={`$${avgAmount.toFixed(4)}`}
          subtext="Micropayment optimized"
        />
      </StatGrid>

      {/* Payment Stream */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="status-pulse w-2 h-2" />
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Live Payment Stream
          </h2>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {recentPayments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No payments recorded yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentPayments.map((payment) => {
                const amount = payment.amount || 0;
                const network = payment.network || 'Solana';
                const fromAddr = payment.from || 'Anonymous';
                const toAddr = payment.agent?.name || payment.agentId || 'Unknown Agent';
                const txSig = payment.txSignature || payment.signature || '';

                return (
                  <div key={payment._id} className="p-4 hover:bg-muted/60 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-green-500 font-mono font-bold">
                        $
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm text-foreground font-mono">
                          <span className="font-bold">${amount.toFixed(4)}</span>
                          <span className="text-muted-foreground">on</span>
                          <span className="text-primary text-xs px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                            {network}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>From: {fromAddr.slice(0, 6)}...</span>
                          <span>→</span>
                          <span>To: {toAddr.slice(0, 10)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">
                        {formatDistanceToNow(payment._creationTime, { addSuffix: true })}
                      </div>
                      {txSig && (
                        <a
                          href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                        >
                          View on Explorer ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
