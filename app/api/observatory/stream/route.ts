/**
 * Server-Sent Events (SSE) Endpoint for Real-time Reputation Updates
 *
 * Provides real-time streaming of reputation events, votes, and agent activity
 * to external clients that can't use Convex's native real-time features.
 *
 * Usage:
 *   const eventSource = new EventSource('/api/observatory/stream?agentAddress=...');
 *   eventSource.onmessage = (event) => {
 *     const data = JSON.parse(event.data);
 *     console.log('Update:', data);
 *   };
 *
 * Event Types:
 *   - reputation_update: Agent reputation score changed
 *   - new_vote: New vote cast for/by agent
 *   - new_attestation: New attestation received
 *   - activity: Agent activity detected
 *   - heartbeat: Keep-alive ping (every 30s)
 */

import { NextRequest } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

export const runtime = 'edge';

// SSE heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Poll interval for updates (5 seconds - balances latency vs load)
const POLL_INTERVAL = 5000;

// Maximum connection duration (5 minutes - serverless timeout friendly)
const MAX_CONNECTION_DURATION = 5 * 60 * 1000;

interface StreamEvent {
  type: 'reputation_update' | 'new_vote' | 'new_attestation' | 'activity' | 'heartbeat' | 'error';
  timestamp: number;
  data: Record<string, unknown>;
}

function encodeSSE(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentAddress = searchParams.get('agentAddress');
  const eventTypes = searchParams.get('events')?.split(',') || [
    'reputation_update',
    'new_vote',
    'activity',
  ];

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response('CONVEX_URL not configured', { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);

  // Track last seen state for change detection
  let lastReputationScore: number | null = null;
  let lastVoteCount: number | null = null;
  let lastActivityTimestamp: number | null = null;

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(
          encodeSSE({
            type: 'activity',
            timestamp: Date.now(),
            data: {
              message: 'Connected to GhostSpeak real-time stream',
              agentAddress,
              eventTypes,
            },
          })
        )
      );

      // Heartbeat interval
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'heartbeat',
                timestamp: Date.now(),
                data: { uptime: Date.now() - startTime },
              })
            )
          );
        } catch {
          // Stream closed
          clearInterval(heartbeatTimer);
        }
      }, HEARTBEAT_INTERVAL);

      // Polling loop for updates
      const pollUpdates = async () => {
        try {
          // Check if connection has exceeded max duration
          if (Date.now() - startTime > MAX_CONNECTION_DURATION) {
            controller.enqueue(
              encoder.encode(
                encodeSSE({
                  type: 'activity',
                  timestamp: Date.now(),
                  data: {
                    message: 'Connection timeout, please reconnect',
                    reason: 'max_duration_exceeded',
                  },
                })
              )
            );
            controller.close();
            clearInterval(heartbeatTimer);
            return;
          }

          if (agentAddress && eventTypes.includes('reputation_update')) {
            // Fetch current agent data
            const agent = await client.query(api.agents.getByAddress, {
              address: agentAddress,
            });

            if (agent) {
              // Check for ghost score changes (reputation)
              const currentScore = agent.ghostScore ?? 0;
              if (
                lastReputationScore !== null &&
                currentScore !== lastReputationScore
              ) {
                controller.enqueue(
                  encoder.encode(
                    encodeSSE({
                      type: 'reputation_update',
                      timestamp: Date.now(),
                      data: {
                        agentAddress,
                        previousScore: lastReputationScore,
                        newScore: currentScore,
                        change: currentScore - lastReputationScore,
                        tier: agent.tier,
                      },
                    })
                  )
                );
              }
              lastReputationScore = currentScore;

              // Check for new votes - get from reputation scores
              if (eventTypes.includes('new_vote')) {
                const reputation = await client.query(api.reputationScores.getForAgent, {
                  agentId: agent._id,
                });
                const totalVotes = reputation?.totalVotes ?? 0;
                if (lastVoteCount !== null && totalVotes > lastVoteCount) {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSE({
                        type: 'new_vote',
                        timestamp: Date.now(),
                        data: {
                          agentAddress,
                          previousVoteCount: lastVoteCount,
                          newVoteCount: totalVotes,
                          trustScore: reputation?.trustScore,
                        },
                      })
                    )
                  );
                }
                lastVoteCount = totalVotes;
              }

              // Check for activity - get from agent profiles
              if (eventTypes.includes('activity')) {
                const profile = await client.query(api.agentProfiles.get, {
                  agentId: agent._id,
                });
                const activityTimestamp = profile?.lastActiveAt ?? agent.updatedAt;
                if (
                  lastActivityTimestamp !== null &&
                  activityTimestamp &&
                  activityTimestamp > lastActivityTimestamp
                ) {
                  controller.enqueue(
                    encoder.encode(
                      encodeSSE({
                        type: 'activity',
                        timestamp: Date.now(),
                        data: {
                          agentAddress,
                          activityTimestamp,
                          totalRequests: profile?.totalRequests ?? 0,
                        },
                      })
                    )
                  );
                }
                lastActivityTimestamp = activityTimestamp ?? null;
              }
            }
          }

          // Continue polling
          setTimeout(pollUpdates, POLL_INTERVAL);
        } catch (error) {
          console.error('SSE poll error:', error);
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'error',
                timestamp: Date.now(),
                data: {
                  message: 'Error fetching updates',
                  error: error instanceof Error ? error.message : String(error),
                },
              })
            )
          );

          // Retry after a longer delay on error
          setTimeout(pollUpdates, POLL_INTERVAL * 2);
        }
      };

      // Start polling
      pollUpdates();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
