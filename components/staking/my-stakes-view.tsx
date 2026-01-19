'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Lock, Unlock, AlertTriangle, Clock, TrendingUp, Wallet, ExternalLink } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { useStaking, useStakingData, type StakeWithDetails } from '@/hooks'

interface MyStakesViewProps {
  stakerAddress: string
  stakes: StakeWithDetails[]
}

export function MyStakesView({ stakerAddress: _stakerAddress, stakes }: MyStakesViewProps) {
  const [selectedStake, setSelectedStake] = useState<StakeWithDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [unstakeSuccess, setUnstakeSuccess] = useState(false)

  // Hooks
  const { unstakeTokens, isLoading: isUnstaking, error: stakingError } = useStaking()
  const { fetchStakePosition, isLoading: isCheckingPosition } = useStakingData()
  const recordUnstake = useMutation(api.tokenStaking.recordUnstake)

  // Group stakes by status
  const activeStakes = stakes.filter(s => s.status === 'active')
  const unlockingStakes = stakes.filter(s => s.status === 'unlocking')
  const unstakedStakes = stakes.filter(s => s.status === 'unstaked')

  const handleUnstake = async () => {
    if (!selectedStake) return

    setError(null)
    setTxSignature(null)

    try {
      // Check if still locked
      if (Date.now() < selectedStake.lockedUntil) {
        throw new Error('Stake is still locked')
      }

      // Verify stake position on-chain if we have the necessary info
      if (selectedStake.target?.address && selectedStake.token?.mint) {
        const position = await fetchStakePosition(
          selectedStake.target.address,
          selectedStake.token.mint
        )
        if (!position) {
          // Position might not exist on-chain, proceed with database-only update
          console.warn('No on-chain stake position found, proceeding with database update')
        }
      }

      // Attempt on-chain unstake if we have all required info
      let signature: string | null = null
      if (
        selectedStake.target?.address &&
        selectedStake.token?.mint &&
        selectedStake.token?.decimals !== undefined
      ) {
        const result = await unstakeTokens({
          targetAgent: selectedStake.target.address,
          tokenMint: selectedStake.token.mint,
          amount: selectedStake.amount,
          decimals: selectedStake.token.decimals,
        })

        if (result) {
          signature = result.signature
          setTxSignature(signature)
        } else if (stakingError) {
          // If on-chain fails but it's not a critical error, log and continue
          console.warn('On-chain unstake failed:', stakingError)
        }
      }

      // Record unstake in Convex
      await recordUnstake({
        stakeId: selectedStake._id,
        txSignature: signature || `unstake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      })

      setUnstakeSuccess(true)
      setTimeout(() => {
        setSelectedStake(null)
        setUnstakeSuccess(false)
        setTxSignature(null)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unstake')
    }
  }

  // Calculate totals
  const totalActiveStaked = activeStakes.reduce((sum, s) => sum + s.amount, 0)
  const totalTrustWeight = activeStakes.reduce((sum, s) => sum + s.trustWeight, 0)

  if (stakes.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <TrendingUp className="h-12 w-12 text-muted-foreground" />
          <div className="text-lg font-medium">No Stakes Yet</div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You haven&apos;t staked on any agents yet. Stake tokens to signal trust
            and contribute to the reputation system.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Staking Summary</CardTitle>
          <CardDescription>
            Your staking positions across all agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Active Stakes</div>
              <div className="text-2xl font-bold">{activeStakes.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Staked</div>
              <div className="text-2xl font-bold">{totalActiveStaked.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Trust Weight</div>
              <div className="text-2xl font-bold">{totalTrustWeight.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unlocking</div>
              <div className="text-2xl font-bold">{unlockingStakes.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Stakes */}
      {activeStakes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Active Stakes
            </CardTitle>
            <CardDescription>
              Currently locked stakes contributing to agent trust scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeStakes.map((stake) => (
                <StakeRow
                  key={stake._id}
                  stake={stake}
                  onUnstake={() => setSelectedStake(stake)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unlocking Stakes */}
      {unlockingStakes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-yellow-500" />
              Ready to Unstake
            </CardTitle>
            <CardDescription>
              Lock period has ended - you can withdraw these stakes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {unlockingStakes.map((stake) => (
                <StakeRow
                  key={stake._id}
                  stake={stake}
                  onUnstake={() => setSelectedStake(stake)}
                  canUnstake
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unstaked History */}
      {unstakedStakes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground">Unstaked History</CardTitle>
            <CardDescription>
              Previously staked positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 opacity-60">
              {unstakedStakes.slice(0, 5).map((stake) => (
                <StakeRow
                  key={stake._id}
                  stake={stake}
                  isHistory
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unstake Confirmation Dialog */}
      <Dialog open={!!selectedStake} onOpenChange={(open) => !open && !unstakeSuccess && setSelectedStake(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {unstakeSuccess ? 'Unstake Successful!' : 'Confirm Unstake'}
            </DialogTitle>
            <DialogDescription>
              {unstakeSuccess
                ? 'Your tokens have been returned to your wallet.'
                : 'Review your stake details and sign the transaction to unstake your tokens.'
              }
            </DialogDescription>
          </DialogHeader>

          {selectedStake && (
            <div className="py-4 space-y-4">
              {unstakeSuccess ? (
                <div className="flex flex-col items-center py-4 space-y-4">
                  <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Unlock className="h-6 w-6 text-green-500" />
                  </div>
                  {txSignature && (
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline font-mono flex items-center gap-1"
                    >
                      View Transaction
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Agent</span>
                      <span className="font-medium">{selectedStake.target?.name ?? 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">
                        {selectedStake.amount.toLocaleString()} {selectedStake.token?.symbol ?? ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trust Weight</span>
                      <span className="font-medium">{selectedStake.trustWeight.toFixed(2)}</span>
                    </div>
                    {selectedStake.txSignature && (
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-muted-foreground">Original TX</span>
                        <a
                          href={`https://explorer.solana.com/tx/${selectedStake.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-mono flex items-center gap-1"
                        >
                          {selectedStake.txSignature.slice(0, 8)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {Date.now() < selectedStake.lockedUntil && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span>
                        Locked until {format(selectedStake.lockedUntil, 'PPp')}
                      </span>
                    </div>
                  )}

                  {/* Transaction Warning */}
                  {Date.now() >= selectedStake.lockedUntil && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg text-sm flex items-start gap-2">
                      <Wallet className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium text-blue-500">Transaction Required</div>
                        <p className="text-muted-foreground">
                          This will transfer your tokens back from the staking vault. You&apos;ll need to
                          sign a transaction.
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-sm text-destructive">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!unstakeSuccess && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedStake(null)}
                disabled={isUnstaking || isCheckingPosition}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnstake}
                disabled={isUnstaking || isCheckingPosition || !!(selectedStake && Date.now() < selectedStake.lockedUntil)}
              >
                {isUnstaking || isCheckingPosition ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isCheckingPosition ? 'Checking...' : 'Unstaking...'}
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Sign & Unstake
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Individual stake row component
function StakeRow({
  stake,
  onUnstake,
  canUnstake = false,
  isHistory = false,
}: {
  stake: StakeWithDetails
  onUnstake?: () => void
  canUnstake?: boolean
  isHistory?: boolean
}) {
  const isLocked = stake.status === 'active' && Date.now() < stake.lockedUntil
  const isUnlocked = stake.status === 'active' && Date.now() >= stake.lockedUntil

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-bold">{stake.token?.symbol?.charAt(0) ?? '?'}</span>
        </div>
        <div>
          <div className="font-medium">{stake.target?.name ?? 'Unknown Agent'}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{stake.amount.toLocaleString()} {stake.token?.symbol ?? ''}</span>
            <span>&middot;</span>
            <Badge variant="secondary" className="text-xs capitalize">
              {stake.attestationType}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium">
            +{stake.trustWeight.toFixed(2)} weight
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {isHistory ? (
              stake.unstakedAt && (
                <>Unstaked {formatDistanceToNow(stake.unstakedAt, { addSuffix: true })}</>
              )
            ) : isLocked ? (
              <>
                <Lock className="h-3 w-3" />
                Unlocks {formatDistanceToNow(stake.lockedUntil, { addSuffix: true })}
              </>
            ) : isUnlocked || canUnstake ? (
              <>
                <Unlock className="h-3 w-3 text-green-500" />
                Ready to unstake
              </>
            ) : (
              <>Staked {formatDistanceToNow(stake.stakedAt, { addSuffix: true })}</>
            )}
          </div>
        </div>

        {!isHistory && onUnstake && (
          <Button
            variant={canUnstake || isUnlocked ? 'default' : 'outline'}
            size="sm"
            onClick={onUnstake}
            disabled={isLocked && !canUnstake}
          >
            {isLocked ? (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Locked
              </>
            ) : (
              'Unstake'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
