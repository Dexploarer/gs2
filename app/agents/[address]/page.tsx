/**
 * Agent Profile Page
 *
 * 2026 Best Practices:
 * - Next.js 15.4 Server Component
 * - React 19.1
 * - Type-safe GraphQL queries
 * - Dynamic rendering (GraphQL requires server runtime)
 */

// Force dynamic rendering - GraphQL uses relative URL that requires server
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation';
import { getAgent, getVotes } from '@/lib/graphql-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, TrendingUp, TrendingDown, Clock, Award } from 'lucide-react';

interface PageProps {
  params: Promise<{
    address: string;
  }>;
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { address } = await params;

  // Fetch agent data (server-side)
  const data = await getAgent(address);

  if (!data || !data.agent) {
    notFound();
  }

  const agent = data.agent;

  // Fetch votes
  const votesData = await getVotes(address, 20, 0);
  const votes = votesData?.votes?.nodes || [];

  // Calculate upvote percentage
  const upvotePercentage =
    agent.totalVotes > 0 ? Math.round((agent.upvotes / agent.totalVotes) * 100) : 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <Avatar className="h-24 w-24">
          <AvatarImage src={agent.metadata?.avatar} alt={agent.name || address} />
          <AvatarFallback className="text-2xl">
            {agent.name?.charAt(0) || address.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{agent.name || 'Anonymous Agent'}</h1>
            {agent.isActive && (
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                Active
              </Badge>
            )}
            {agent.metadata?.supportsMicropayments && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                Micropayments
              </Badge>
            )}
          </div>

          {agent.category && (
            <Badge variant="secondary" className="mb-3">
              {agent.category}
            </Badge>
          )}

          {agent.metadata?.description && (
            <p className="text-muted-foreground mb-3">{agent.metadata.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono">{address.slice(0, 8)}...{address.slice(-8)}</span>
            {agent.metadata?.website && (
              <a
                href={agent.metadata.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Website
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {agent.metadata?.x402Endpoint && (
              <a
                href={agent.metadata.x402Endpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                x402 Endpoint
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {agent.metadata?.tags && agent.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {agent.metadata.tags.map((tag: string) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <Separator className="my-8" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-500" />
              Reputation Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{agent.reputation}</div>
            <p className="text-xs text-muted-foreground mt-1">out of 1000</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{agent.totalVotes}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                {agent.upvotes} upvotes
              </div>
              <div className="flex items-center gap-1 text-xs text-red-600">
                <TrendingDown className="h-3 w-3" />
                {agent.downvotes} downvotes
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{agent.averageQuality.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">out of 100</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Upvote Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{upvotePercentage}%</div>
            <p className="text-xs text-muted-foreground mt-1">positive feedback</p>
          </CardContent>
        </Card>
      </div>

      {/* Quality Breakdown */}
      {votes.length > 0 && votes[0].qualityScores && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quality Breakdown</CardTitle>
            <CardDescription>Average scores from recent votes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['responseQuality', 'responseSpeed', 'accuracy', 'professionalism'].map((metric) => {
                const avgScore = votes.reduce(
                  (sum: number, v: { qualityScores?: Record<string, number> }) =>
                    sum + (v.qualityScores?.[metric] || 0),
                  0
                ) / votes.length;

                return (
                  <div key={metric}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium capitalize">
                        {metric.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-sm text-muted-foreground">{avgScore.toFixed(1)}/100</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${avgScore}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Votes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Votes</CardTitle>
          <CardDescription>{votes.length} most recent reviews</CardDescription>
        </CardHeader>
        <CardContent>
          {votes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No votes yet</p>
          ) : (
            <div className="space-y-4">
              {votes.map((vote: { id: string; voteType: string; voter: string; timestamp: string; qualityScores?: { responseQuality?: number; responseSpeed?: number; accuracy?: number; professionalism?: number }; transactionSignature?: string }) => (
                <div key={vote.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {vote.voteType === 'UPVOTE' ? (
                        <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Upvote
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Downvote
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground font-mono">
                        {vote.voter.slice(0, 6)}...{vote.voter.slice(-6)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(Number(vote.timestamp) * 1000).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Quality</div>
                      <div className="font-semibold">{vote.qualityScores?.responseQuality || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Speed</div>
                      <div className="font-semibold">{vote.qualityScores?.responseSpeed || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Accuracy</div>
                      <div className="font-semibold">{vote.qualityScores?.accuracy || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Professional</div>
                      <div className="font-semibold">{vote.qualityScores?.professionalism || 0}</div>
                    </div>
                  </div>

                  {vote.transactionSignature && (
                    <a
                      href={`https://explorer.solana.com/tx/${vote.transactionSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1"
                    >
                      View transaction proof
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

