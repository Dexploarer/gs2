'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useConnector } from '@solana/connector'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import type { Id } from '@/convex/_generated/dataModel'

interface VotingInterfaceProps {
  subjectAgentId?: Id<'agents'>
  subjectMerchantId?: Id<'merchants'>
  subjectType: 'agent' | 'merchant'
}

/**
 * Payment-backed community voting interface with Ghost Score weighting
 *
 * IMPORTANT: Votes REQUIRE a transaction between the voter and subject.
 * This prevents spam/sybil attacks by ensuring only agents who have actually
 * transacted can vote on each other.
 */
export function VotingInterface({
  subjectAgentId,
  subjectMerchantId,
  subjectType,
}: VotingInterfaceProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<Id<'agentTransactions'> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get wallet connection status
  const { connected, selectedAccount } = useConnector()

  // Look up voter's agent by wallet address
  const voterAgent = useQuery(
    api.agents.getByAddress,
    connected && selectedAccount ? { address: selectedAccount } : 'skip'
  )

  // Use the voter's agent ID if they have one
  const currentUserAgentId = voterAgent?._id

  // Fetch transactions between voter and subject (for payment-backed voting)
  const transactions = useQuery(
    api.agentTransactions.getBetweenAgents,
    currentUserAgentId && subjectAgentId
      ? { agentId1: currentUserAgentId, agentId2: subjectAgentId }
      : 'skip'
  )

  // Fetch existing votes
  const votes = useQuery(api.reputationVotes.getForSubjectPublic, {
    subjectAgentId,
    subjectMerchantId,
    subjectType,
  })

  const castVote = useMutation(api.reputationVotes.cast)

  const voteTypes = [
    { id: 'trustworthy', label: 'Trustworthy', icon: '👍', category: 'positive' },
    { id: 'untrustworthy', label: 'Untrustworthy', icon: '👎', category: 'negative' },
    { id: 'high_quality', label: 'High Quality', icon: '⭐', category: 'positive' },
    { id: 'low_quality', label: 'Low Quality', icon: '⚠️', category: 'negative' },
    { id: 'reliable', label: 'Reliable', icon: '✓', category: 'positive' },
    { id: 'unreliable', label: 'Unreliable', icon: '✗', category: 'negative' },
  ]

  const handleVote = async (voteType: string) => {
    if (isSubmitting) return
    if (!currentUserAgentId) {
      console.error('Cannot vote without a registered agent')
      return
    }
    if (!selectedTransactionId) {
      console.error('Cannot vote without selecting a transaction')
      return
    }

    setIsSubmitting(true)

    try {
      await castVote({
        voterAgentId: currentUserAgentId,
        subjectAgentId,
        subjectMerchantId,
        subjectType,
        voteType: voteType as 'trustworthy' | 'untrustworthy' | 'high_quality' | 'low_quality' | 'reliable' | 'unreliable',
        reason: '',
        basedOnTransactionId: selectedTransactionId,
      })
      setSelectedTransactionId(null) // Reset after successful vote
    } catch (error) {
      console.error('Failed to cast vote:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine if user can vote
  const hasTransactions = transactions && transactions.length > 0
  const canVote = connected && currentUserAgentId && hasTransactions && selectedTransactionId
  const isLoadingAuth = connected && voterAgent === undefined

  // Calculate vote statistics
  const voteStats = votes?.reduce(
    (acc: { positive: number; negative: number; total: number }, vote) => {
      const category = voteTypes.find((v) => v.id === vote.voteType)?.category || 'neutral'
      if (category === 'positive') {
        acc.positive += vote.weight
      } else if (category === 'negative') {
        acc.negative += vote.weight
      }
      acc.total += vote.weight
      return acc
    },
    { positive: 0, negative: 0, total: 0 }
  ) || { positive: 0, negative: 0, total: 0 }

  const positivePercentage =
    voteStats.total > 0 ? (voteStats.positive / voteStats.total) * 100 : 0
  const negativePercentage =
    voteStats.total > 0 ? (voteStats.negative / voteStats.total) * 100 : 0

  // Format transaction for display
  const formatTransaction = (tx: NonNullable<typeof transactions>[0]) => {
    const date = new Date(tx.timestamp).toLocaleDateString()
    const direction = tx.type === 'payment_sent' ? 'Paid' : 'Received'
    return `${direction} $${tx.amountUSDC.toFixed(2)} on ${date}`
  }

  return (
    <div className="space-y-4">
      {/* Vote Statistics */}
      {votes && votes.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Community Sentiment</div>
          <div className="flex gap-2 h-8 rounded-lg overflow-hidden">
            <div
              className="bg-green-600 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${positivePercentage}%` }}
            >
              {positivePercentage > 10 && `${positivePercentage.toFixed(0)}%`}
            </div>
            <div
              className="bg-red-600 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${negativePercentage}%` }}
            >
              {negativePercentage > 10 && `${negativePercentage.toFixed(0)}%`}
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>👍 {voteStats.positive.toFixed(1)} weighted votes</span>
            <span>👎 {voteStats.negative.toFixed(1)} weighted votes</span>
          </div>
        </div>
      )}

      {/* Voting Section */}
      <div className="space-y-3">
        <div className="text-sm font-medium">Cast Your Vote</div>

        {/* Not connected - show connect button */}
        {!connected && (
          <div className="p-4 border border-dashed rounded-lg text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your wallet to vote on this {subjectType}
            </p>
            <ConnectWalletButton variant="default" size="sm" />
          </div>
        )}

        {/* Connected but loading agent */}
        {isLoadingAuth && (
          <div className="p-4 border border-dashed rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Loading your agent...</p>
          </div>
        )}

        {/* Connected but no agent registered */}
        {connected && voterAgent === null && (
          <div className="p-4 border border-dashed rounded-lg text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              No agent registered with this wallet address
            </p>
            <p className="text-xs text-muted-foreground">
              Register your agent to participate in community voting
            </p>
          </div>
        )}

        {/* Has agent but no transactions with subject */}
        {currentUserAgentId && !hasTransactions && transactions !== undefined && (
          <div className="p-4 border border-dashed border-amber-500/50 bg-amber-50/10 rounded-lg text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Payment Required:</strong> You must have a transaction with this {subjectType} to vote
            </p>
            <p className="text-xs text-muted-foreground">
              Complete an x402 payment with this agent first, then return to cast your vote.
            </p>
          </div>
        )}

        {/* Has transactions - show transaction selector */}
        {currentUserAgentId && hasTransactions && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Select a transaction to base your vote on:
              </label>
              <select
                className="w-full p-2 text-sm border rounded-lg bg-background"
                value={selectedTransactionId || ''}
                onChange={(e) => setSelectedTransactionId(e.target.value as Id<'agentTransactions'> || null)}
              >
                <option value="">-- Select a transaction --</option>
                {transactions.map((tx) => (
                  <option key={tx._id} value={tx._id}>
                    {formatTransaction(tx)}
                  </option>
                ))}
              </select>
            </div>

            {/* Voting buttons - only enabled when transaction is selected */}
            <div className="grid grid-cols-2 gap-2">
              {voteTypes.map((voteType) => (
                <Button
                  key={voteType.id}
                  variant={
                    voteType.category === 'positive'
                      ? 'default'
                      : voteType.category === 'negative'
                        ? 'destructive'
                        : 'outline'
                  }
                  size="sm"
                  onClick={() => handleVote(voteType.id)}
                  disabled={!canVote || isSubmitting}
                  className="text-xs"
                >
                  <span className="mr-1">{voteType.icon}</span>
                  {voteType.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment-backed Voting Info */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="text-xs text-muted-foreground">
          <strong>Payment-Backed Voting:</strong> Votes must be backed by a real transaction
          between you and the {subjectType}. This prevents spam and ensures authentic reviews.
          {voterAgent && (
            <span className="block mt-1">
              Your Ghost Score: <strong>{voterAgent.ghostScore}</strong> ({voterAgent.tier} tier)
              - higher scores have more voting weight
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
