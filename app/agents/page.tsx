/**
 * Agent Discovery Page
 *
 * 2026 Best Practices:
 * - Next.js 15.4 Server Component
 * - React 19.1 with useActionState for filters
 * - Search params for filter state
 * - Incremental Static Regeneration
 */

import Link from 'next/link';
import { searchAgents, getTopAgents } from '@/lib/graphql-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Award, TrendingUp, Filter } from 'lucide-react';
import { AgentFilters } from './components/agent-filters';

type SortBy = 'REPUTATION' | 'TOTAL_VOTES' | 'AVERAGE_QUALITY' | 'CREATED_AT';
type SortOrder = 'ASC' | 'DESC';

interface PageProps {
  searchParams: Promise<{
    category?: string;
    minScore?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
  }>;
}

export default async function AgentsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = parseInt(params.page || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  // Fetch agents with filters
  const data = await searchAgents({
    category: params.category,
    minScore: params.minScore ? parseInt(params.minScore) : undefined,
    search: params.search,
    limit,
    offset,
    sortBy: (params.sortBy as SortBy) || 'REPUTATION',
    sortOrder: (params.sortOrder as SortOrder) || 'DESC',
  });

  const agents = data?.agents?.nodes || [];
  const totalCount = data?.agents?.totalCount || 0;
  const hasNextPage = data?.agents?.hasNextPage || false;

  // Fetch top agents for sidebar
  const topData = await getTopAgents(5, 5);
  const topAgents = topData?.topAgents || [];

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Discover AI Agents</h1>
        <p className="text-muted-foreground">
          Browse {totalCount} trusted AI agents with transaction-verified reputation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar - Top Agents */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Top Rated
              </CardTitle>
              <CardDescription>Highest reputation scores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topAgents.map((agent, index) => (
                <Link key={agent.address} href={`/agents/${agent.address}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                    <div className="flex-shrink-0 w-6 text-center font-bold text-muted-foreground">
                      #{index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={agent.metadata?.avatar} />
                      <AvatarFallback>
                        {agent.name?.charAt(0) || agent.address.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {agent.name || 'Anonymous'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {agent.reputation} rep · {agent.totalVotes} votes
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Filters */}
          <AgentFilters
            initialFilters={{
              category: params.category,
              minScore: params.minScore,
              search: params.search,
              sortBy: params.sortBy,
              sortOrder: params.sortOrder,
            }}
          />

          {/* Results */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + limit, totalCount)} of {totalCount} agents
            </p>
            {params.search && (
              <p className="text-sm">
                Search results for: <span className="font-semibold">{params.search}</span>
              </p>
            )}
          </div>

          {agents.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No agents found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or search query
                </p>
                <Link href="/agents">
                  <Button variant="outline">Clear filters</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {agents.map((agent) => (
                <Link key={agent.address} href={`/agents/${agent.address}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={agent.metadata?.avatar} />
                          <AvatarFallback>
                            {agent.name?.charAt(0) || agent.address.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg mb-1 truncate">
                            {agent.name || 'Anonymous Agent'}
                          </CardTitle>
                          {agent.category && (
                            <Badge variant="secondary" className="mb-2">
                              {agent.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {agent.metadata?.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {agent.metadata.description}
                        </p>
                      )}

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-xl font-bold">{agent.reputation}</div>
                          <div className="text-xs text-muted-foreground">Reputation</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold">{agent.totalVotes}</div>
                          <div className="text-xs text-muted-foreground">Votes</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold">{agent.averageQuality.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">Quality</div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex gap-2">
                          {agent.isActive && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                              Active
                            </Badge>
                          )}
                          {agent.metadata?.supportsMicropayments && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs">
                              $0.001+
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <TrendingUp className="h-3 w-3" />
                          {Math.round((agent.upvotes / (agent.totalVotes || 1)) * 100)}% upvotes
                        </div>
                      </div>

                      {agent.metadata?.tags && agent.metadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {agent.metadata.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {agent.metadata.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{agent.metadata.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={{
                    pathname: '/agents',
                    query: { ...params, page: page - 1 },
                  }}
                >
                  <Button variant="outline">Previous</Button>
                </Link>
              )}

              <span className="text-sm text-muted-foreground px-4">
                Page {page} of {totalPages}
              </span>

              {hasNextPage && (
                <Link
                  href={{
                    pathname: '/agents',
                    query: { ...params, page: page + 1 },
                  }}
                >
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Revalidate every 60 seconds (ISR)
export const revalidate = 60;
