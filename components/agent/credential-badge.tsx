'use client'

import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface CredentialBadgeProps {
  type: string
  issuedAt: number
  showDate?: boolean
  onClick?: () => void
}

/**
 * Display W3C Verifiable Credential badge with icon and tooltip
 */
export function CredentialBadge({
  type,
  issuedAt,
  showDate = false,
  onClick,
}: CredentialBadgeProps) {
  const credentialConfig: Record<
    string,
    { label: string; icon: string; variant: 'default' | 'secondary' | 'outline' }
  > = {
    // Performance Credentials
    HighVolumeAgent: { label: 'High Volume', icon: '📈', variant: 'default' },
    ReliableService: { label: 'Reliable', icon: '✓', variant: 'default' },
    FastResponse: { label: 'Fast', icon: '⚡', variant: 'default' },
    Established: { label: 'Established', icon: '⭐', variant: 'default' },

    // Certification Credentials
    ISO42001Certified: { label: 'ISO 42001', icon: '🏆', variant: 'secondary' },
    SOC2Compliant: { label: 'SOC 2', icon: '🔒', variant: 'secondary' },
    AuditedByGhostSpeak: { label: 'Audited', icon: '🔍', variant: 'secondary' },
    CommunityTrusted: { label: 'Trusted', icon: '💎', variant: 'secondary' },

    // Capability Credentials
    WeatherDataProvider: { label: 'Weather', icon: '🌤️', variant: 'outline' },
    CodeReviewExpert: { label: 'Code Review', icon: '👨‍💻', variant: 'outline' },
    CryptoPriceOracle: { label: 'Crypto Prices', icon: '💰', variant: 'outline' },
    AIImageGenerator: { label: 'Image Gen', icon: '🎨', variant: 'outline' },
    DataAnalysisExpert: { label: 'Data Analysis', icon: '📊', variant: 'outline' },
    ComputeProvider: { label: 'Compute', icon: '🖥️', variant: 'outline' },
  }

  const config = credentialConfig[type] || {
    label: type,
    icon: '📜',
    variant: 'outline' as const,
  }

  const timeAgo = formatDistanceToNow(new Date(issuedAt), { addSuffix: true })

  return (
    <Badge
      variant={config.variant}
      className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
      title={`Issued ${timeAgo}`}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
      {showDate && (
        <span className="ml-1 text-muted-foreground">• {timeAgo}</span>
      )}
    </Badge>
  )
}
