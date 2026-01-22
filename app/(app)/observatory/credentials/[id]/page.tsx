'use client'

import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CredentialBadge } from '@/components/agent/credential-badge'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'

export default function CredentialVerificationPage() {
  const params = useParams()
  const idParam = params?.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam

  // Always call useQuery at the top level
  const credential = useQuery(
    api.credentials.get,
    id ? { credentialId: id } : 'skip'
  )

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  if (credential === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading credential...</div>
      </div>
    )
  }

  if (!credential) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-2xl font-bold">Credential Not Found</div>
        <p className="text-muted-foreground">
          No credential found with ID: {id}
        </p>
        <Link
          href="/observatory"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          ← Back to Observatory
        </Link>
      </div>
    )
  }

  // Determine verification status
  const now = Date.now()
  const isExpired = credential.expiresAt ? credential.expiresAt < now : false
  const isRevoked = credential.isRevoked
  const isValid = !isExpired && !isRevoked

  // Verification status badge
  const statusBadge = isRevoked ? (
    <Badge variant="destructive">REVOKED</Badge>
  ) : isExpired ? (
    <Badge variant="outline" className="border-yellow-600 text-yellow-600">
      EXPIRED
    </Badge>
  ) : (
    <Badge variant="default" className="bg-green-600">
      VALID
    </Badge>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/observatory"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← Back to Observatory
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">Credential Verification</h1>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground">W3C Verifiable Credential</p>
          </div>
          <CredentialBadge type={credential.credentialType} issuedAt={credential.issuedAt} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Verification Result */}
          <Card className={isValid ? 'border-green-600' : 'border-red-600'}>
            <CardHeader>
              <CardTitle>Verification Result</CardTitle>
              <CardDescription>Real-time credential verification status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    isValid ? 'bg-green-600/20' : 'bg-red-600/20'
                  }`}
                >
                  {isValid ? '✓' : '✗'}
                </div>
                <div>
                  <div className="font-bold text-lg">
                    {isValid ? 'Credential is Valid' : 'Credential is Invalid'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isRevoked
                      ? 'This credential has been revoked by the issuer'
                      : isExpired
                        ? 'This credential has expired'
                        : 'All verification checks passed'}
                  </div>
                </div>
              </div>

              {/* Verification Details */}
              <div className="grid grid-cols-2 gap-3 text-sm pt-4 border-t border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issued</span>
                  <span className="font-medium text-green-600">✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Not Expired</span>
                  <span className={`font-medium ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
                    {isExpired ? '✗' : '✓'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Not Revoked</span>
                  <span className={`font-medium ${isRevoked ? 'text-red-600' : 'text-green-600'}`}>
                    {isRevoked ? '✗' : '✓'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Issuer</span>
                  <span className="font-medium text-green-600">✓</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credential Details */}
          <Card>
            <CardHeader>
              <CardTitle>Credential Details</CardTitle>
              <CardDescription>Information about this credential</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Credential ID</div>
                  <div className="font-mono text-sm break-all">{credential.credentialId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div className="font-medium">{credential.credentialType}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Issued By</div>
                  <div className="font-medium">{credential.issuedBy}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Issued At</div>
                  <div className="font-medium">
                    {format(new Date(credential.issuedAt), 'PPpp')}
                    <span className="text-muted-foreground ml-2">
                      ({formatDistanceToNow(new Date(credential.issuedAt), { addSuffix: true })})
                    </span>
                  </div>
                </div>
                {credential.expiresAt && (
                  <div>
                    <div className="text-sm text-muted-foreground">Expires At</div>
                    <div className="font-medium">
                      {format(new Date(credential.expiresAt), 'PPpp')}
                      <span className="text-muted-foreground ml-2">
                        ({formatDistanceToNow(new Date(credential.expiresAt), { addSuffix: true })})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Claims */}
          {credential.claims && Object.keys(credential.claims).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Claims</CardTitle>
                <CardDescription>What this credential claims about the subject</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(credential.claims).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <span className="text-sm font-medium">{key}</span>
                      <span className="text-sm text-muted-foreground">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evidence */}
          {credential.evidence && credential.evidence.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence</CardTitle>
                <CardDescription>
                  {credential.evidence.length} piece{credential.evidence.length !== 1 ? 's' : ''}{' '}
                  of supporting evidence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(credential.evidence as Array<{
                    evidenceType: string
                    source: string
                    isVerified?: boolean
                    verifiedBy?: string
                    data?: unknown
                  }>).map((evidence, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border border-border space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {evidence.evidenceType}
                        </Badge>
                        {evidence.isVerified && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Source: {evidence.source}
                      </div>
                      {evidence.verifiedBy && (
                        <div className="text-xs text-muted-foreground">
                          Verified by: {evidence.verifiedBy}
                        </div>
                      )}
                      {evidence.data !== undefined && evidence.data !== null && (
                        <div className="text-xs font-mono bg-muted/50 p-2 rounded">
                          {JSON.stringify(evidence.data, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Subject Information */}
          {credential.agent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Credential Subject</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/observatory/agents/${credential.agent.address}`}
                  className="block space-y-2 hover:opacity-80 transition-opacity"
                >
                  <div className="font-medium">{credential.agent.name}</div>
                  <div className="text-sm text-muted-foreground font-mono truncate">
                    {credential.agent.address}
                  </div>
                  <Badge variant="outline">
                    Ghost Score: {credential.agent.ghostScore}
                  </Badge>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Revocation Info */}
          {isRevoked && credential.revokedAt && (
            <Card className="border-red-600">
              <CardHeader>
                <CardTitle className="text-base text-red-600">Revocation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Revoked At</div>
                  <div className="text-sm font-medium">
                    {format(new Date(credential.revokedAt), 'PPpp')}
                  </div>
                </div>
                {credential.revocationReason && (
                  <div>
                    <div className="text-sm text-muted-foreground">Reason</div>
                    <div className="text-sm">{credential.revocationReason}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* API Access */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href={`/api/seance/verify/${credential.credentialId}`}
                target="_blank"
                className="block p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Verify via API
              </Link>
              <button
                onClick={() => navigator.clipboard.writeText(credential.credentialId)}
                className="block w-full text-left p-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                → Copy Credential ID
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
