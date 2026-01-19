'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useConnector } from '@solana/connector'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { ConnectWalletButton } from '@/components/wallet/connect-button'
import { Badge } from '@/components/ui/badge'
import type { Id } from '@/convex/_generated/dataModel'

interface EndorsementInterfaceProps {
  subjectAgentId: Id<'agents'>
  subjectAgentName?: string
}

const endorsementTypes = [
  {
    id: 'endorsement',
    label: 'General Endorsement',
    icon: '👍',
    description: 'I trust this agent overall',
    defaultClaim: 'I endorse this agent based on my experience in the community',
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: '⭐',
    description: 'High-quality outputs',
    defaultClaim: 'This agent consistently delivers high-quality work',
  },
  {
    id: 'reliability',
    label: 'Reliability',
    icon: '⚡',
    description: 'Dependable & responsive',
    defaultClaim: 'This agent is reliable and responsive',
  },
  {
    id: 'capability_verification',
    label: 'Capability',
    icon: '✓',
    description: 'Verified capabilities',
    defaultClaim: 'I can verify this agent has the stated capabilities',
  },
  {
    id: 'security',
    label: 'Security',
    icon: '🔒',
    description: 'Safe & secure',
    defaultClaim: 'This agent follows security best practices',
  },
] as const

type EndorsementType = (typeof endorsementTypes)[number]['id']

/**
 * Endorsement Interface - Allows agents to vouch for each other WITHOUT requiring a transaction
 *
 * Unlike payment-backed voting, endorsements are:
 * - Free to give (no transaction required)
 * - Weighted by endorser's Ghost Score
 * - Connected to the trust graph via attestations
 * - Good for building initial trust before transactions occur
 */
export function EndorsementInterface({
  subjectAgentId,
  subjectAgentName,
}: EndorsementInterfaceProps) {
  const [selectedType, setSelectedType] = useState<EndorsementType | null>(null)
  const [customClaim, setCustomClaim] = useState('')
  const [confidence, setConfidence] = useState(75) // Default 75% confidence
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Get wallet connection status
  const { connected, selectedAccount } = useConnector()

  // Look up endorser's agent by wallet address
  const endorserAgent = useQuery(
    api.agents.getByAddress,
    connected && selectedAccount ? { address: selectedAccount } : 'skip'
  )

  const currentUserAgentId = endorserAgent?._id

  // Get existing endorsements by this user for this agent
  const existingEndorsements = useQuery(
    api.agentAttestations.getByAttestor,
    currentUserAgentId ? { attestorAgentId: currentUserAgentId, limit: 50 } : 'skip'
  )

  // Filter to endorsements for this specific subject
  const myEndorsementsForSubject = existingEndorsements?.filter(
    (e) => e.subjectAgentId === subjectAgentId
  )

  const createAttestation = useMutation(api.agentAttestations.create)

  const handleEndorse = async () => {
    if (!selectedType || !currentUserAgentId || isSubmitting) return

    setIsSubmitting(true)
    setSuccess(false)

    const typeConfig = endorsementTypes.find((t) => t.id === selectedType)
    const claim = customClaim.trim() || typeConfig?.defaultClaim || 'General endorsement'

    try {
      await createAttestation({
        attestorAgentId: currentUserAgentId,
        subjectAgentId,
        attestationType: selectedType,
        claim,
        confidence,
        basedOn: 'community_endorsement',
      })

      setSuccess(true)
      setSelectedType(null)
      setCustomClaim('')
      setConfidence(75)

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to create endorsement:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLoadingAuth = connected && endorserAgent === undefined
  const isSelf = currentUserAgentId === subjectAgentId

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Endorse This Agent</h3>
          <p className="text-xs text-muted-foreground">
            Vouch without requiring a transaction
          </p>
        </div>
        {endorserAgent && (
          <Badge variant="outline" className="text-xs">
            Your GS: {endorserAgent.ghostScore}
          </Badge>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-600 dark:text-green-400">
          ✓ Endorsement created successfully! It will appear in the trust graph.
        </div>
      )}

      {/* Existing endorsements by user */}
      {myEndorsementsForSubject && myEndorsementsForSubject.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="text-xs font-medium">Your existing endorsements:</div>
          <div className="flex flex-wrap gap-1">
            {myEndorsementsForSubject.map((e) => {
              const config = endorsementTypes.find((t) => t.id === e.attestationType)
              return (
                <Badge key={e._id} variant="secondary" className="text-xs">
                  {config?.icon || '•'} {config?.label || e.attestationType}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* Not connected - show connect button */}
      {!connected && (
        <div className="p-4 border border-dashed rounded-lg text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to endorse this agent
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
      {connected && endorserAgent === null && (
        <div className="p-4 border border-dashed rounded-lg text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No agent registered with this wallet address
          </p>
          <p className="text-xs text-muted-foreground">
            Register your agent to endorse others
          </p>
        </div>
      )}

      {/* Self-endorsement not allowed */}
      {isSelf && (
        <div className="p-4 border border-dashed border-amber-500/50 bg-amber-50/10 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            You cannot endorse yourself
          </p>
        </div>
      )}

      {/* Endorsement form */}
      {currentUserAgentId && !isSelf && (
        <div className="space-y-4">
          {/* Endorsement type selection */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Select endorsement type:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {endorsementTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    selectedType === type.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span className="text-sm font-medium">{type.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom claim (optional) */}
          {selectedType && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Custom message (optional):
              </label>
              <textarea
                className="w-full p-2 text-sm border rounded-lg bg-background resize-none"
                rows={2}
                placeholder={
                  endorsementTypes.find((t) => t.id === selectedType)?.defaultClaim
                }
                value={customClaim}
                onChange={(e) => setCustomClaim(e.target.value)}
              />
            </div>
          )}

          {/* Confidence slider */}
          {selectedType && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Confidence level:</span>
                <span className="font-medium">{confidence}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          )}

          {/* Submit button */}
          <Button
            onClick={handleEndorse}
            disabled={!selectedType || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              'Creating Endorsement...'
            ) : (
              <>
                Endorse {subjectAgentName || 'Agent'}
                {selectedType && (
                  <span className="ml-2">
                    {endorsementTypes.find((t) => t.id === selectedType)?.icon}
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Info box */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="text-xs text-muted-foreground">
          <strong>Endorsement vs Voting:</strong>
          <ul className="mt-1 space-y-1 ml-3">
            <li>• <strong>Endorsements</strong> don&apos;t require a transaction - good for building initial trust</li>
            <li>• <strong>Votes</strong> require a payment receipt - stronger signal, prevents spam</li>
            <li>• Both contribute to the trust graph and reputation scores</li>
            <li>• Higher Ghost Score = more weight for your endorsements</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
