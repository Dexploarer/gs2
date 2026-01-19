'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import { Loader2, Check, Search, ArrowRight, Wallet, AlertCircle, RefreshCw } from 'lucide-react'
import {
  useStaking,
  useTokenBalance,
  useStakingData,
  mapAttestationToCategory,
  type AttestationType,
  type AgentTier,
} from '@/hooks'

interface StakeTokensFormProps {
  stakerAddress: string
  stakerAgent: Doc<'agents'> | null | undefined
  stakingTokens: Array<Doc<'stakingTokens'> & { owner: { type: string; name: string; address?: string } | null }>
  onSuccess?: () => void
}

export function StakeTokensForm({
  stakerAddress,
  stakerAgent,
  stakingTokens,
  onSuccess,
}: StakeTokensFormProps) {
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form')
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)

  // Form state
  const [selectedTokenId, setSelectedTokenId] = useState<string>('')
  const [targetAgentAddress, setTargetAgentAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [attestationType, setAttestationType] = useState<AttestationType>('endorsement')

  // Hooks
  const { stakeTokens, isLoading: isStaking, error: stakingError } = useStaking()
  const { fetchBalance, isLoading: isFetchingBalance } = useTokenBalance()
  const { fetchVault, isLoading: isCheckingVault } = useStakingData()
  const recordStake = useMutation(api.tokenStaking.recordStake)

  // Token balance state
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)

  // Search for agent by address
  const searchResults = useQuery(
    api.agents.searchByAddress,
    targetAgentAddress.length >= 6 ? { query: targetAgentAddress, limit: 5 } : 'skip'
  )

  const [selectedTargetAgent, setSelectedTargetAgent] = useState<Doc<'agents'> | null>(null)

  // Get selected token details
  const selectedToken = useMemo(() => {
    return stakingTokens.find(t => t._id === selectedTokenId)
  }, [stakingTokens, selectedTokenId])

  // Fetch token balance when token is selected
  useEffect(() => {
    if (selectedToken) {
      fetchBalance(selectedToken.tokenMint).then((result) => {
        if (result) {
          setTokenBalance(result.balance)
        }
      })
    } else {
      setTokenBalance(null)
    }
  }, [selectedToken, fetchBalance])

  // Calculate estimated trust weight
  const estimatedTrustWeight = useMemo(() => {
    if (!amount || !selectedToken) return 0
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 0
    return Math.log2(amountNum + 1) * (selectedToken.weightMultiplier ?? 1)
  }, [amount, selectedToken])

  const handleSelectAgent = (agent: Doc<'agents'>) => {
    setSelectedTargetAgent(agent)
    setTargetAgentAddress(agent.address)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      if (!selectedTokenId || !selectedToken) {
        throw new Error('Please select a token to stake')
      }

      if (!selectedTargetAgent) {
        throw new Error('Please select an agent to stake on')
      }

      const stakeAmount = parseFloat(amount)
      if (isNaN(stakeAmount) || stakeAmount <= 0) {
        throw new Error('Please enter a valid stake amount')
      }

      if (stakeAmount < selectedToken.minStakeAmount) {
        throw new Error(`Minimum stake amount is ${selectedToken.minStakeAmount} ${selectedToken.tokenSymbol}`)
      }

      // Check token balance
      if (tokenBalance !== null && stakeAmount > tokenBalance) {
        throw new Error(`Insufficient balance. You have ${tokenBalance.toLocaleString()} ${selectedToken.tokenSymbol}`)
      }

      // Check if vault exists for this agent/token
      const vault = await fetchVault(selectedTargetAgent.address, selectedToken.tokenMint)
      if (!vault || !vault.isActive) {
        throw new Error('No staking vault exists for this agent/token combination. The agent must first register this token for staking.')
      }

      // Move to confirmation step
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    }
  }

  // Stake tokens on-chain and record in Convex
  const handleConfirmAndSign = async () => {
    setError(null)

    try {
      if (!selectedToken || !selectedTargetAgent) {
        throw new Error('Missing token or agent selection')
      }

      const stakeAmount = parseFloat(amount)

      // Stake tokens on-chain
      const result = await stakeTokens({
        targetAgent: selectedTargetAgent.address,
        tokenMint: selectedToken.tokenMint,
        amount: stakeAmount,
        category: mapAttestationToCategory(attestationType),
        decimals: selectedToken.tokenDecimals,
      })

      if (!result) {
        throw new Error(stakingError || 'Failed to stake tokens on-chain')
      }

      setTxSignature(result.signature)

      // Calculate raw amount based on decimals
      const rawAmount = (stakeAmount * Math.pow(10, selectedToken.tokenDecimals)).toString()

      // Record in Convex
      await recordStake({
        stakerAddress,
        stakerAgentId: stakerAgent?._id,
        targetAgentId: selectedTargetAgent._id,
        stakingTokenId: selectedTokenId as Id<'stakingTokens'>,
        amount: stakeAmount,
        amountRaw: rawAmount,
        attestationType,
        txSignature: result.signature,
      })

      setStep('success')
      setTimeout(() => {
        onSuccess?.()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stake tokens')
    }
  }

  if (stakingTokens.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <div className="text-lg font-medium">No Staking Tokens Available</div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            There are no tokens registered for staking yet.
            Be the first to register a token!
          </p>
        </CardContent>
      </Card>
    )
  }

  if (step === 'success') {
    return (
      <Card className="border-2 border-green-500/50">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-500" />
          </div>
          <div className="text-lg font-medium">Stake Successful!</div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Your tokens have been staked on-chain. This stake now contributes
            to the agent&apos;s Ghost Score and trust metrics.
          </p>
          {txSignature && (
            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline font-mono"
            >
              View Transaction
            </a>
          )}
        </CardContent>
      </Card>
    )
  }

  if (step === 'confirm') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm Stake</CardTitle>
          <CardDescription>
            Review your stake details and sign the transaction to stake your tokens on-chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Token</div>
                <div className="font-medium">{selectedToken?.tokenSymbol} - {selectedToken?.tokenName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-medium">{parseFloat(amount).toLocaleString()} {selectedToken?.tokenSymbol}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Target Agent</div>
                <div className="font-medium">{selectedTargetAgent?.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Attestation Type</div>
                <Badge variant="secondary" className="capitalize">
                  {attestationType}
                </Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Lock Period</div>
                <div className="font-medium">
                  {selectedToken ? Math.floor(selectedToken.lockPeriodSeconds / 86400) : 0} days
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Trust Weight</div>
                <div className="font-medium text-primary">+{estimatedTrustWeight.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-sm flex items-start gap-2">
            <Wallet className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-yellow-500">Transaction Required</div>
              <p className="text-muted-foreground">
                This will transfer tokens to the staking vault on Solana. You&apos;ll need to sign a
                transaction. Tokens will be locked for the specified period.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('form')}
              disabled={isStaking}
            >
              Back
            </Button>
            <Button
              onClick={handleConfirmAndSign}
              disabled={isStaking}
            >
              {isStaking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Staking...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Sign & Stake
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stake Tokens on Agent</CardTitle>
        <CardDescription>
          Signal trust in an agent by staking tokens. Your stake contributes to their
          Ghost Score and creates an economic attestation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token Selection */}
          <div className="space-y-2">
            <Label>Select Token</Label>
            <Select value={selectedTokenId} onValueChange={setSelectedTokenId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a token to stake" />
              </SelectTrigger>
              <SelectContent>
                {stakingTokens.map((token) => (
                  <SelectItem key={token._id} value={token._id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.tokenSymbol}</span>
                      <span className="text-muted-foreground">- {token.tokenName}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedToken && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <span>Min: {selectedToken.minStakeAmount.toLocaleString()}</span>
                <span>Lock: {Math.floor(selectedToken.lockPeriodSeconds / 86400)} days</span>
                <span>Staked: {selectedToken.totalStaked.toLocaleString()}</span>
                {isFetchingBalance ? (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Checking balance...
                  </span>
                ) : tokenBalance !== null ? (
                  <span className="text-primary font-medium">
                    Your balance: {tokenBalance.toLocaleString()}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Agent Search */}
          <div className="space-y-2">
            <Label>Target Agent</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agent by address..."
                value={targetAgentAddress}
                onChange={(e) => {
                  setTargetAgentAddress(e.target.value)
                  if (e.target.value !== selectedTargetAgent?.address) {
                    setSelectedTargetAgent(null)
                  }
                }}
                className="pl-10 font-mono"
              />
            </div>

            {/* Search Results */}
            {searchResults && searchResults.length > 0 && !selectedTargetAgent && (
              <div className="border rounded-lg divide-y">
                {searchResults.map((agent) => (
                  <button
                    key={agent._id}
                    type="button"
                    className="w-full p-3 text-left hover:bg-secondary/50 transition-colors flex items-center justify-between"
                    onClick={() => handleSelectAgent(agent)}
                  >
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {agent.address.slice(0, 8)}...{agent.address.slice(-8)}
                      </div>
                    </div>
                    <GhostScoreBadge
                      score={agent.ghostScore}
                      tier={agent.tier as AgentTier}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Selected Agent */}
            {selectedTargetAgent && (
              <div className="p-4 bg-secondary/50 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-medium">{selectedTargetAgent.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {selectedTargetAgent.address}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <GhostScoreBadge
                    score={selectedTargetAgent.ghostScore}
                    tier={selectedTargetAgent.tier as AgentTier}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedTargetAgent(null)
                      setTargetAgentAddress('')
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Amount and Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Stake Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder={selectedToken ? `Min: ${selectedToken.minStakeAmount}` : 'Amount'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={selectedToken?.minStakeAmount ?? 0}
                step="any"
              />
              {tokenBalance !== null && selectedToken && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setAmount(tokenBalance.toString())}
                >
                  Max: {tokenBalance.toLocaleString()} {selectedToken.tokenSymbol}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Attestation Type</Label>
              <Select value={attestationType} onValueChange={(v) => setAttestationType(v as AttestationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="endorsement">Endorsement</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="reliability">Reliability</SelectItem>
                  <SelectItem value="capability">Capability</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          {selectedToken && amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <div className="text-sm font-medium">Stake Preview</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Amount</div>
                  <div className="font-medium">
                    {parseFloat(amount).toLocaleString()} {selectedToken.tokenSymbol}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Lock Period</div>
                  <div className="font-medium">
                    {Math.floor(selectedToken.lockPeriodSeconds / 86400)} days
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Trust Weight</div>
                  <div className="font-medium text-primary">
                    +{estimatedTrustWeight.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Attestation</div>
                  <Badge variant="secondary" className="capitalize">
                    {attestationType}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={isCheckingVault || !selectedToken || !selectedTargetAgent}>
              {isCheckingVault ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
