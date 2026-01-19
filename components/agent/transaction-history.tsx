'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import type { Id } from '@/convex/_generated/dataModel'

interface TransactionHistoryProps {
  agentId: Id<'agents'>
  limit?: number
}

/**
 * Display recent transaction history for an agent
 */
export function TransactionHistory({ agentId, limit = 10 }: TransactionHistoryProps) {
  const transactions = useQuery(api.agentTransactions.getByAgent, {
    agentId,
    limit,
  })

  if (transactions === undefined) {
    return <div className="text-sm text-muted-foreground">Loading transactions...</div>
  }

  if (transactions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No transactions yet
      </div>
    )
  }

  const typeLabels: Record<string, { label: string; icon: string }> = {
    payment_sent: { label: 'Sent', icon: '↗' },
    payment_received: { label: 'Received', icon: '↙' },
    refund: { label: 'Refund', icon: '↩' },
    fee: { label: 'Fee', icon: '💳' },
  }

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-600',
    pending: 'bg-yellow-600',
    failed: 'bg-red-600',
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const typeConfig = typeLabels[tx.type] || { label: tx.type, icon: '•' }

        return (
          <div
            key={tx._id}
            className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {typeConfig.icon} {typeConfig.label}
                </Badge>
                <Badge
                  className={`text-xs ${statusColors[tx.status] || 'bg-gray-600'}`}
                >
                  {tx.status}
                </Badge>
              </div>
              <div className="text-sm font-medium">
                ${tx.amountUSDC.toFixed(4)} USDC
              </div>
              {tx.merchantId && (
                <div className="text-xs text-muted-foreground">
                  Merchant: {tx.merchantId}
                </div>
              )}
              {tx.facilitator && (
                <div className="text-xs text-muted-foreground">
                  via {tx.facilitator.name}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              {tx.confirmationTime !== undefined && (
                <div className="text-xs text-muted-foreground">
                  {tx.confirmationTime}ms
                </div>
              )}
              {tx.txSignature && (
                <a
                  href={`https://solscan.io/tx/${tx.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View →
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
