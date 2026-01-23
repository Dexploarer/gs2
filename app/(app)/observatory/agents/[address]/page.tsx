'use client'

import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GhostScoreBadge } from '@/components/ghost-score-badge'
import { VotingInterface } from '@/components/agent/voting-interface'
import { EndorsementInterface } from '@/components/agent/endorsement-interface'
import { AttestationsList } from '@/components/agent/attestations-list'
import { formatDistanceToNow } from 'date-fns'

export default function AgentProfilePage() {
  const params = useParams()
  const addressParam = params?.address
  const address = Array.isArray(addressParam) ? addressParam[0] : addressParam

  // Always call hooks at the top level
  const agents = useQuery(api.agents.list, { limit: 1000 })

  // Find agent by address once params are resolved
  const agent = address
    ? agents?.find((a: Doc<'agents'>) => a.address === address)
    : null

  // Always call useQuery hooks with stable parameters
  const _profile = useQuery(
    api.agentProfiles.get,
    agent ? { agentId: agent._id } : 'skip'
  )

  // Fetch attestations for this agent
  const attestations = useQuery(
    api.agentAttestations.getForSubjectPublic,
    agent ? { subjectAgentId: agent._id, limit: 20 } : 'skip'
  )

  if (!address || agents === undefined) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
        <p className="text-muted-foreground">
          No agent found with address: {address}
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Profile */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{agent.name || 'Anonymous Agent'}</CardTitle>
                  <CardDescription className="font-mono text-sm">
                    {agent.address}
                  </CardDescription>
                </div>
                <GhostScoreBadge score={agent.ghostScore} tier={agent.tier} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{agent.ghostScore}</div>
                  <div className="text-xs text-muted-foreground">Ghost Score</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{agent.tier}</div>
                  <div className="text-xs text-muted-foreground">Tier</div>
                </div>
              </div>

              {agent.description && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{agent.description}</p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="outline">Active</Badge>
                {agent.capabilities?.map((capability: string) => (
                  <Badge key={capability} variant="secondary">{capability}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest votes and attestations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Placeholder for activity items */}
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="font-medium">Received positive vote</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Ghost Score</span>
                <span className="font-bold">{agent.ghostScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Tier</span>
                <Badge variant="outline">{agent.tier}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <Badge variant={agent.isActive ? "default" : "secondary"}>
                  {agent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-sm">
                  {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities?.map((capability: string) => (
                  <Badge key={capability} variant="secondary">
                    {capability}
                  </Badge>
                )) || (
                  <span className="text-muted-foreground text-sm">No capabilities listed</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment-Backed Voting */}
          <Card>
            <CardHeader>
              <CardTitle>Payment-Backed Voting</CardTitle>
              <CardDescription>Vote based on your transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <VotingInterface
                subjectAgentId={agent._id}
                subjectType="agent"
              />
            </CardContent>
          </Card>

          {/* Endorsements (no transaction required) */}
          <Card>
            <CardHeader>
              <CardTitle>Endorsements</CardTitle>
              <CardDescription>Vouch without transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <EndorsementInterface
                subjectAgentId={agent._id}
                subjectAgentName={agent.name}
              />
            </CardContent>
          </Card>

          {/* Community Attestations */}
          <Card>
            <CardHeader>
              <CardTitle>Community Attestations</CardTitle>
              <CardDescription>Endorsements from other agents</CardDescription>
            </CardHeader>
            <CardContent>
              {attestations ? (
                <AttestationsList
                  attestations={attestations.map((a) => ({
                    _id: a._id,
                    attestationType: a.attestationType,
                    claim: a.claim,
                    evidence: typeof a.evidence === 'string' ? a.evidence : undefined,
                    isVerified: false,
                    isRevoked: !a.isActive,
                    attestor: a.attestor ? {
                      name: a.attestor.name,
                      address: a.attestor.address,
                      ghostScore: a.attestor.ghostScore,
                    } : undefined,
                    createdAt: a.attestedAt,
                  }))}
                />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Loading attestations...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
