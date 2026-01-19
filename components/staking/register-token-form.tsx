'use client'

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Check, AlertCircle, RefreshCw, Wallet } from 'lucide-react'
import { useStaking, useTokenMetadata, useStakingData } from '@/hooks'
import type { Doc } from '@/convex/_generated/dataModel'

interface RegisterTokenFormProps {
  agent: Doc<'agents'> | null | undefined
  onSuccess?: () => void
}

export function RegisterTokenForm({ agent, onSuccess }: RegisterTokenFormProps) {
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form')
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [_vaultAddress, setVaultAddress] = useState<string | null>(null)

  // Form state
  const [tokenMint, setTokenMint] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenName, setTokenName] = useState('')
  const [tokenDecimals, setTokenDecimals] = useState('6')
  const [minStakeAmount, setMinStakeAmount] = useState('100')
  const [lockPeriodDays, setLockPeriodDays] = useState('7')
  const [vaultType, setVaultType] = useState<'pda' | 'token_account' | 'external'>('pda')

  // Hooks
  const { initializeVault, isLoading: isInitializing, error: stakingError } = useStaking()
  const { fetchTokenMetadata, isLoading: isFetchingMetadata } = useTokenMetadata()
  const { vaultExists, isLoading: isCheckingVault } = useStakingData()
  const registerToken = useMutation(api.tokenStaking.registerToken)

  // Auto-fetch token metadata when mint address changes
  useEffect(() => {
    if (tokenMint.length >= 32) {
      fetchTokenMetadata(tokenMint).then((metadata) => {
        if (metadata) {
          setTokenDecimals(metadata.decimals.toString())
        }
      })
    }
  }, [tokenMint, fetchTokenMetadata])

  // Handle form validation and submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      if (!agent) {
        throw new Error('No agent connected. Register an agent first.')
      }

      // Validate inputs
      if (!tokenMint || tokenMint.length < 32) {
        throw new Error('Invalid token mint address')
      }

      if (!tokenSymbol || tokenSymbol.length > 10) {
        throw new Error('Token symbol must be 1-10 characters')
      }

      if (!tokenName || tokenName.length > 50) {
        throw new Error('Token name must be 1-50 characters')
      }

      const decimals = parseInt(tokenDecimals)
      if (isNaN(decimals) || decimals < 0 || decimals > 18) {
        throw new Error('Decimals must be between 0 and 18')
      }

      const minStake = parseFloat(minStakeAmount)
      if (isNaN(minStake) || minStake <= 0) {
        throw new Error('Minimum stake must be greater than 0')
      }

      const lockDays = parseInt(lockPeriodDays)
      if (isNaN(lockDays) || lockDays < 1 || lockDays > 365) {
        throw new Error('Lock period must be between 1 and 365 days')
      }

      // Check if vault already exists on-chain
      const exists = await vaultExists(agent.address, tokenMint)
      if (exists) {
        // Vault exists, skip to registration
        await registerInConvex(null, null)
        return
      }

      // Move to confirmation step
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    }
  }

  // Initialize vault on-chain and register in Convex
  const handleConfirmAndSign = async () => {
    setError(null)

    try {
      if (!agent) {
        throw new Error('No agent connected')
      }

      const decimals = parseInt(tokenDecimals)
      const minStake = parseFloat(minStakeAmount)
      const lockDays = parseInt(lockPeriodDays)

      // Initialize vault on-chain
      const result = await initializeVault({
        targetAgent: agent.address,
        tokenMint,
        minStakeAmount: minStake,
        lockPeriodDays: lockDays,
        weightMultiplier: 100,
        decimals,
      })

      if (!result) {
        throw new Error(stakingError || 'Failed to initialize vault on-chain')
      }

      setTxSignature(result.signature)
      setVaultAddress(result.vaultAddress)

      // Register in Convex
      await registerInConvex(result.signature, result.vaultAddress)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault')
    }
  }

  // Register token in Convex database
  const registerInConvex = async (signature: string | null, vault: string | null) => {
    if (!agent) return

    const decimals = parseInt(tokenDecimals)
    const minStake = parseFloat(minStakeAmount)
    const lockDays = parseInt(lockPeriodDays)

    await registerToken({
      agentId: agent._id,
      tokenMint,
      tokenSymbol: tokenSymbol.toUpperCase(),
      tokenName,
      tokenDecimals: decimals,
      minStakeAmount: minStake,
      lockPeriodSeconds: lockDays * 24 * 60 * 60,
      vaultType,
      vaultAddress: vault ?? undefined,
      weightMultiplier: 1,
    })

    if (signature) {
      setTxSignature(signature)
    }
    if (vault) {
      setVaultAddress(vault)
    }
    setStep('success')
    setTimeout(() => {
      onSuccess?.()
    }, 2000)
  }

  if (!agent) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <div className="text-lg font-medium">No Agent Registered</div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You need to have a registered agent to create staking tokens.
            Your connected wallet is not associated with any agent.
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
          <div className="text-lg font-medium">Vault Created & Token Registered!</div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Your staking vault has been created on-chain and the token is now registered.
            Others can stake on your agent using this token.
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
          <CardTitle>Confirm Vault Creation</CardTitle>
          <CardDescription>
            Review your settings and sign the transaction to create your staking vault on-chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Token</div>
                <div className="font-medium">{tokenSymbol} - {tokenName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Decimals</div>
                <div className="font-medium">{tokenDecimals}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Minimum Stake</div>
                <div className="font-medium">{minStakeAmount} {tokenSymbol}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Lock Period</div>
                <div className="font-medium">{lockPeriodDays} days</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-mono pt-2 border-t">
              Mint: {tokenMint}
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-sm flex items-start gap-2">
            <Wallet className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-yellow-500">Transaction Required</div>
              <p className="text-muted-foreground">
                This will create a staking vault on Solana. You&apos;ll need to sign a transaction
                and pay a small network fee (~0.01 SOL).
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
              disabled={isInitializing}
            >
              Back
            </Button>
            <Button
              onClick={handleConfirmAndSign}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Vault...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Sign & Create Vault
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
        <CardTitle>Register Staking Token</CardTitle>
        <CardDescription>
          Register your SPL token to allow others to stake on your agent.
          This creates a secure PDA vault on Solana for token custody.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token Mint Address */}
          <div className="space-y-2">
            <Label htmlFor="tokenMint">Token Mint Address</Label>
            <div className="relative">
              <Input
                id="tokenMint"
                placeholder="Enter SPL token mint address"
                value={tokenMint}
                onChange={(e) => setTokenMint(e.target.value)}
                className="font-mono pr-10"
              />
              {isFetchingMetadata && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The Solana address of your SPL token mint. Decimals will be auto-detected.
            </p>
          </div>

          {/* Token Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tokenSymbol">Symbol</Label>
              <Input
                id="tokenSymbol"
                placeholder="e.g., GHOST"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tokenName">Name</Label>
              <Input
                id="tokenName"
                placeholder="e.g., Ghost Token"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tokenDecimals">Decimals</Label>
              <Input
                id="tokenDecimals"
                type="number"
                placeholder="6"
                value={tokenDecimals}
                onChange={(e) => setTokenDecimals(e.target.value)}
                min={0}
                max={18}
                disabled={isFetchingMetadata}
              />
            </div>
          </div>

          {/* Staking Config Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minStakeAmount">Minimum Stake Amount</Label>
              <Input
                id="minStakeAmount"
                type="number"
                placeholder="100"
                value={minStakeAmount}
                onChange={(e) => setMinStakeAmount(e.target.value)}
                min={0}
                step="any"
              />
              <p className="text-xs text-muted-foreground">
                Minimum tokens required to stake
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockPeriodDays">Lock Period (days)</Label>
              <Input
                id="lockPeriodDays"
                type="number"
                placeholder="7"
                value={lockPeriodDays}
                onChange={(e) => setLockPeriodDays(e.target.value)}
                min={1}
                max={365}
              />
              <p className="text-xs text-muted-foreground">
                How long staked tokens are locked
              </p>
            </div>
          </div>

          {/* Vault Type */}
          <div className="space-y-2">
            <Label>Vault Type</Label>
            <Select value={vaultType} onValueChange={(v) => setVaultType(v as typeof vaultType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pda">
                  PDA Vault (Recommended)
                </SelectItem>
                <SelectItem value="token_account">
                  Token Account
                </SelectItem>
                <SelectItem value="external">
                  External Vault
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              PDA vaults are controlled by the staking program for maximum security
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={isCheckingVault}>
              {isCheckingVault ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
