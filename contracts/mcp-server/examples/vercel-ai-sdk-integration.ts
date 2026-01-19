/**
 * Vercel AI SDK Integration Example
 *
 * Shows how to use GhostSpeak MCP server with Vercel AI SDK
 * to enable AI agents to query reputation data.
 *
 * Install:
 *   bun add ai @ai-sdk/openai zod
 *
 * Run:
 *   export OPENAI_API_KEY=your-key
 *   bun run examples/vercel-ai-sdk-integration.ts
 */

import { generateText, tool, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';

// Type assertion for AI SDK options that may vary by version
type GenerateTextOptions = Parameters<typeof generateText>[0] & { maxSteps?: number };

// Solana connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Program IDs
const REPUTATION_REGISTRY_PROGRAM_ID = 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp';
const VOTE_REGISTRY_PROGRAM_ID = 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6';

// Tools implementation (same logic as MCP server)
const getAgentReputation = tool({
  description: 'Query reputation score and statistics for a GhostSpeak agent',
  parameters: z.object({
    agentAddress: z.string().describe('Solana public key of the agent'),
  }),
  execute: async ({ agentAddress }: { agentAddress: string }) => {
    try {
      const agentPubkey = new PublicKey(agentAddress);

      // Derive reputation PDA
      const [reputationPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('reputation'), agentPubkey.toBuffer()],
        new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID)
      );

      // Fetch reputation account
      const accountInfo = await connection.getAccountInfo(reputationPda);

      if (!accountInfo) {
        return {
          error: 'Agent not found or has no reputation data',
          address: agentAddress,
        };
      }

      // Parse reputation score
      const data = accountInfo.data;
      const reputationScore = data.readUInt16LE(40);

      // Fetch vote statistics
      const votes = await connection.getProgramAccounts(
        new PublicKey(VOTE_REGISTRY_PROGRAM_ID),
        {
          filters: [
            {
              memcmp: {
                offset: 40,
                bytes: agentPubkey.toBase58(),
              },
            },
          ],
        }
      );

      let upvotes = 0;
      let downvotes = 0;
      let totalQuality = 0;

      for (const vote of votes) {
        const voteData = vote.account.data;
        const voteType = voteData.readUInt8(104);
        if (voteType === 0) upvotes++;
        else downvotes++;

        const responseQuality = voteData.readUInt8(105);
        const responseSpeed = voteData.readUInt8(106);
        const accuracy = voteData.readUInt8(107);
        const professionalism = voteData.readUInt8(108);

        totalQuality += (responseQuality + responseSpeed + accuracy + professionalism) / 4;
      }

      return {
        address: agentAddress,
        reputationScore,
        totalVotes: votes.length,
        upvotes,
        downvotes,
        averageQualityScore: votes.length > 0 ? totalQuality / votes.length : 0,
        isActive: true,
      };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

const searchAgents = tool({
  description: 'Search for agents by category and minimum reputation score',
  parameters: z.object({
    category: z.string().describe('Agent category'),
    minScore: z.number().default(0).describe('Minimum reputation score'),
    limit: z.number().default(10).describe('Maximum results'),
  }),
  execute: async ({ category, minScore, limit }: { category: string; minScore: number; limit: number }) => {
    try {
      // Fetch all reputation accounts
      const reputationAccounts = await connection.getProgramAccounts(
        new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID)
      );

      const agents = [];

      for (const account of reputationAccounts) {
        const data = account.account.data;
        const agentPubkey = new PublicKey(data.slice(8, 40));
        const reputationScore = data.readUInt16LE(40);

        if (reputationScore >= minScore) {
          agents.push({
            address: agentPubkey.toBase58(),
            reputationScore,
          });

          if (agents.length >= limit) break;
        }
      }

      agents.sort((a, b) => b.reputationScore - a.reputationScore);

      return {
        category,
        minScore,
        count: agents.length,
        agents,
      };
    } catch (error: any) {
      return { error: error.message };
    }
  },
});

// Example 1: Simple reputation query
async function example1() {
  console.log('\n=== Example 1: Agent Reputation Query ===\n');

  const result = await generateText({
    model: openai('gpt-4o'),
    tools: {
      get_agent_reputation: getAgentReputation,
    },
    prompt: 'What is the reputation of agent 7xY5tZ8qR3pW9nH4cV2mJ6kL1fA3sD8uE5rT9yI2oP7q?',
    maxSteps: 5,
  } as GenerateTextOptions);

  console.log(result.text);
  console.log('\nTool Calls:', result.toolCalls);
}

// Example 2: Agent discovery
async function example2() {
  console.log('\n=== Example 2: Agent Discovery ===\n');

  const result = await generateText({
    model: openai('gpt-4o'),
    tools: {
      search_agents: searchAgents,
    },
    prompt: 'Find me the top 5 agents with reputation score above 800',
    maxSteps: 5,
  } as GenerateTextOptions);

  console.log(result.text);
}

// Example 3: Trust verification
async function example3() {
  console.log('\n=== Example 3: Trust Verification ===\n');

  const result = await generateText({
    model: openai('gpt-4o'),
    tools: {
      get_agent_reputation: getAgentReputation,
      search_agents: searchAgents,
    },
    prompt: `I'm considering using an AI agent for code assistance.
             Can you help me find a trustworthy agent and verify their reputation?`,
    maxSteps: 10,
  } as GenerateTextOptions);

  console.log(result.text);
}

// Example 4: Streaming response
type StreamTextOptions = Parameters<typeof streamText>[0] & { maxSteps?: number };

async function example4() {
  console.log('\n=== Example 4: Streaming Reputation Query ===\n');

  const { textStream } = await streamText({
    model: openai('gpt-4o'),
    tools: {
      get_agent_reputation: getAgentReputation,
    },
    prompt: 'Check the reputation of agent 3mK8pL9qW2xR7nH5cV1mJ4kT6fB2sD9uE8rY1oI5pN3q',
    maxSteps: 5,
  } as StreamTextOptions);

  for await (const textPart of textStream) {
    process.stdout.write(textPart);
  }
  console.log('\n');
}

// Run examples
async function main() {
  console.log('GhostSpeak + Vercel AI SDK Integration Examples');
  console.log('================================================\n');

  try {
    await example1();
    await example2();
    await example3();
    // await example4(); // Uncomment if you want streaming
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
