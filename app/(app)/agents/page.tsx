/**
 * Agent Discovery Page
 * Redesigned with x402scan-inspired "Functional Minimalism"
 */

import Link from 'next/link'
import { searchAgents, getTopAgents } from '@/lib/graphql-client'
import { AgentFilters } from './components/agent-filters'

type SortBy = 'REPUTATION' | 'TOTAL_VOTES' | 'AVERAGE_QUALITY' | 'CREATED_AT'
type SortOrder = 'ASC' | 'DESC'

interface PageProps {
  searchParams: Promise<{
    category?: string
    minScore?: string
    search?: string
    sortBy?: string
    sortOrder?: string
    page?: string
  }>
}

export default async function AgentsPage({ searchParams }: PageProps) {
  const params = await searchParams

  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const data = await searchAgents({
    category: params.category,
    minScore: params.minScore ? parseInt(params.minScore) : undefined,
    search: params.search,
    limit,
    offset,
    sortBy: (params.sortBy as SortBy) || 'REPUTATION',
    sortOrder: (params.sortOrder as SortOrder) || 'DESC',
  })

  const agents = data?.agents?.nodes || []
  const totalCount = data?.agents?.totalCount || 0
  const hasNextPage = data?.agents?.hasNextPage || false

  const topData = await getTopAgents(5, 5)
  const topAgents = topData?.topAgents || []

  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold text-foreground mb-2">
          Agent Discovery
        </h1>
        <p className="text-muted-foreground">
          {totalCount} verified agents in the x402 ecosystem
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar - Top Agents */}
        <div className="lg:col-span-1">
          <div className="p-5 bg-card border border-border rounded-xl sticky top-20">
            <div className="flex items-center gap-2 mb-6">
              <div className="status-pulse w-2 h-2" />
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Top Rated</h3>
            </div>

            <div className="space-y-1">
              {topAgents.map((agent, index) => (
                <Link key={agent.address} href={`/agents/${agent.address}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors group">
                    <span className="font-mono text-xs text-primary w-4">{index + 1}</span>
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {agent.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {agent.name || 'Anonymous'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {agent.reputation} rep
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Filters */}
          <div className="mb-6">
            <AgentFilters
              initialFilters={{
                category: params.category,
                minScore: params.minScore,
                search: params.search,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
              }}
            />
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between mb-6 text-sm">
            <span className="text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + limit, totalCount)} of {totalCount}
            </span>
            {params.search && (
              <span className="text-muted-foreground">
                Search: <span className="text-primary">{params.search}</span>
              </span>
            )}
          </div>

          {agents.length === 0 ? (
            <div className="p-12 bg-card border border-border rounded-xl text-center">
              <div className="text-foreground mb-2">No agents found</div>
              <p className="text-muted-foreground text-sm mb-6">Try adjusting your filters</p>
              <Link href="/agents">
                <button className="btn-shimmer px-6 py-2 bg-primary text-black font-semibold text-sm rounded-lg">
                  Clear Filters
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {agents.map((agent) => (
                <Link key={agent.address} href={`/agents/${agent.address}`}>
                  <div className="tool-card group p-5 bg-card border border-border rounded-xl hover:bg-muted/60 transition-all duration-300 h-full">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-muted-foreground">
                          {agent.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-foreground font-semibold truncate group-hover:text-primary transition-colors">
                          {agent.name || 'Anonymous Agent'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {agent.category && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 text-primary rounded">
                              {agent.category}
                            </span>
                          )}
                          {agent.isActive && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-[10px] text-green-600">Active</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {agent.metadata?.description && (
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                        {agent.metadata.description}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-4 text-center mb-4">
                      <div>
                        <div className="text-lg font-mono font-bold text-primary">{agent.reputation}</div>
                        <div className="text-muted-foreground text-xs">Rep</div>
                      </div>
                      <div>
                        <div className="text-lg font-mono font-bold text-foreground">{agent.totalVotes}</div>
                        <div className="text-muted-foreground text-xs">Votes</div>
                      </div>
                      <div>
                        <div className="text-lg font-mono font-bold text-foreground">{agent.averageQuality.toFixed(1)}</div>
                        <div className="text-muted-foreground text-xs">Quality</div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                      </span>
                      <span className="text-primary">
                        {Math.round((agent.upvotes / (agent.totalVotes || 1)) * 100)}% ↑
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              {page > 1 && (
                <Link href={{ pathname: '/agents', query: { ...params, page: page - 1 } }}>
                  <button className="px-6 py-2 bg-muted text-foreground text-sm rounded-lg hover:bg-muted/80 transition-colors">
                    Previous
                  </button>
                </Link>
              )}
              <span className="text-muted-foreground text-sm font-mono">
                {page} / {totalPages}
              </span>
              {hasNextPage && (
                <Link href={{ pathname: '/agents', query: { ...params, page: page + 1 } }}>
                  <button className="btn-shimmer px-6 py-2 bg-primary text-black text-sm font-semibold rounded-lg">
                    Next
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const revalidate = 60
