'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// This will be replaced with Convex useQuery for real-time updates
interface Payment {
  id: string
  agent: string
  endpoint: string
  amount: number
  network: 'solana' | 'base'
  status: 'completed' | 'pending' | 'failed'
  responseTime: number
  timestamp: number
}

interface PaymentStreamProps {
  payments: Payment[]
  maxItems?: number
}

const formatTimestamp = (timestamp: number) => {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
}

export function PaymentStream({ payments, maxItems = 10 }: PaymentStreamProps) {
  const displayPayments = payments.slice(0, maxItems)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Stream</CardTitle>
            <CardDescription>Live x402 transactions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">LIVE</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {displayPayments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center gap-3 p-2 rounded-lg border border-border text-xs hover:bg-accent/50 transition-colors"
            >
              <Badge
                variant={
                  payment.status === 'completed'
                    ? 'default'
                    : payment.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                }
                className="text-xs flex-shrink-0"
              >
                {payment.status}
              </Badge>

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{payment.agent}</div>
                <div className="text-muted-foreground font-mono truncate">{payment.endpoint}</div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="font-semibold">${payment.amount.toFixed(3)}</div>
                <div className="text-muted-foreground">{payment.network}</div>
              </div>

              <div className="text-right flex-shrink-0 w-16">
                <div
                  className={`font-mono ${
                    payment.responseTime < 500
                      ? 'text-green-600 dark:text-green-400'
                      : payment.responseTime < 2000
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {payment.responseTime}ms
                </div>
                <div className="text-muted-foreground">{formatTimestamp(payment.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
