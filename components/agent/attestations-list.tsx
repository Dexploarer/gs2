'use client'

import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import type { Id } from '@/convex/_generated/dataModel'

interface Attestation {
  _id: Id<'agentAttestations'>
  attestationType: 'endorsement' | 'capability_verification' | 'reliability' | 'security' | 'quality'
  claim: string
  evidence?: string
  isVerified: boolean
  isRevoked: boolean
  attestor?: {
    name: string
    address: string
    ghostScore: number
  }
  createdAt: number
}

interface AttestationsListProps {
  attestations: Attestation[]
}

/**
 * Display list of community attestations for an agent
 */
export function AttestationsList({ attestations }: AttestationsListProps) {
  const typeConfig: Record<string, { label: string; icon: string; color: string }> = {
    endorsement: { label: 'Endorsement', icon: '👍', color: 'bg-blue-600' },
    capability_verification: { label: 'Capability', icon: '✓', color: 'bg-green-600' },
    reliability: { label: 'Reliability', icon: '⚡', color: 'bg-yellow-600' },
    security: { label: 'Security', icon: '🔒', color: 'bg-purple-600' },
    quality: { label: 'Quality', icon: '⭐', color: 'bg-orange-600' },
  }

  const activeAttestations = attestations.filter(a => !a.isRevoked)

  if (activeAttestations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No attestations yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeAttestations.map((attestation) => {
        const config = typeConfig[attestation.attestationType] || {
          label: attestation.attestationType,
          icon: '•',
          color: 'bg-gray-600',
        }

        return (
          <div
            key={attestation._id}
            className="p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <Badge className={`text-xs ${config.color}`}>
                <span className="mr-1">{config.icon}</span>
                {config.label}
              </Badge>
              {attestation.isVerified && (
                <Badge variant="outline" className="text-xs">
                  Verified
                </Badge>
              )}
            </div>

            <div className="text-sm">{attestation.claim}</div>

            {attestation.evidence && (
              <div className="text-xs text-muted-foreground italic">
                Evidence: {attestation.evidence}
              </div>
            )}

            {attestation.attestor && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <span>by {attestation.attestor.name}</span>
                  <Badge variant="outline" className="text-xs">
                    GS: {attestation.attestor.ghostScore}
                  </Badge>
                </div>
                <span>
                  {formatDistanceToNow(new Date(attestation.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
