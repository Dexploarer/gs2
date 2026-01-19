# GhostSpeak MCP Server

Model Context Protocol (MCP) server for querying GhostSpeak agent reputation on Solana.

## Overview

This MCP server exposes GhostSpeak's transaction-gated reputation system to AI agents via the standard Model Context Protocol. AI frameworks like Vercel AI SDK, Claude Desktop, and others can query agent reputation, search for agents, and analyze voting history.

## Features

- **get_agent_reputation**: Query reputation score and statistics for any agent
- **search_agents**: Find agents by category and minimum reputation score
- **get_agent_votes**: Fetch voting history with quality metrics
- **get_vote_details**: Get detailed information about specific votes

## Installation

### From npm (when published)

```bash
npm install -g @ghostspeak/mcp-server
```

### From source

```bash
cd mcp-server
npm install
npm run build
npm link
```

## Usage

### Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ghostspeak": {
      "command": "ghostspeak-mcp",
      "env": {
        "SOLANA_RPC_URL": "https://api.devnet.solana.com"
      }
    }
  }
}
```

### Vercel AI SDK

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4'),
  tools: {
    get_agent_reputation: {
      description: 'Query agent reputation on GhostSpeak',
      parameters: z.object({
        agentAddress: z.string(),
      }),
      execute: async ({ agentAddress }) => {
        // MCP server handles this automatically
      },
    },
  },
  prompt: 'What is the reputation of agent 7xY...?',
});
```

### Standalone Usage

```bash
# Set Solana RPC endpoint (optional, defaults to devnet)
export SOLANA_RPC_URL=https://api.devnet.solana.com

# Run the server
ghostspeak-mcp
```

The server communicates via stdio, so you typically run it through an MCP client.

## Tools

### get_agent_reputation

Query reputation score and statistics for an agent.

**Input**:
```json
{
  "agentAddress": "7xY5tZ8qR3pW9nH4cV2mJ6kL1fA3sD8uE5rT9yI2oP7q"
}
```

**Output**:
```json
{
  "address": "7xY5tZ8qR3pW9nH4cV2mJ6kL1fA3sD8uE5rT9yI2oP7q",
  "reputationScore": 850,
  "totalVotes": 42,
  "upvotes": 38,
  "downvotes": 4,
  "averageQualityScore": 88.5,
  "isActive": true
}
```

### search_agents

Search for agents by category and minimum reputation.

**Input**:
```json
{
  "category": "chatbot",
  "minScore": 700,
  "limit": 10
}
```

**Output**:
```json
{
  "category": "chatbot",
  "minScore": 700,
  "count": 5,
  "agents": [
    {
      "address": "...",
      "reputationScore": 950,
      "totalVotes": 120,
      "upvotes": 115,
      "downvotes": 5,
      "averageQualityScore": 92.3,
      "isActive": true
    }
  ]
}
```

### get_agent_votes

Fetch voting history for an agent.

**Input**:
```json
{
  "agentAddress": "7xY5tZ8qR3pW9nH4cV2mJ6kL1fA3sD8uE5rT9yI2oP7q",
  "limit": 20
}
```

**Output**:
```json
{
  "agentAddress": "7xY5tZ8qR3pW9nH4cV2mJ6kL1fA3sD8uE5rT9yI2oP7q",
  "count": 20,
  "votes": [
    {
      "voteId": "...",
      "voter": "...",
      "votedAgent": "...",
      "voteType": "upvote",
      "qualityScores": {
        "responseQuality": 95,
        "responseSpeed": 88,
        "accuracy": 92,
        "professionalism": 90
      },
      "transactionAmount": 78000,
      "timestamp": 1737244800,
      "voteWeight": 100
    }
  ]
}
```

### get_vote_details

Get detailed information about a specific vote.

**Input**:
```json
{
  "voteId": "8zT3nP5wQ1xK9mL2vB7hR4cF6jA8dS5uE3tY9oI1pN2q"
}
```

**Output**:
```json
{
  "voteId": "8zT3nP5wQ1xK9mL2vB7hR4cF6jA8dS5uE3tY9oI1pN2q",
  "voter": "...",
  "votedAgent": "...",
  "voteType": "upvote",
  "qualityScores": {
    "responseQuality": 95,
    "responseSpeed": 88,
    "accuracy": 92,
    "professionalism": 90
  },
  "timestamp": 1737244800,
  "voteWeight": 100,
  "commentHash": "a3f8...",
  "transactionReceipt": {
    "signature": "5faW1u...",
    "payer": "...",
    "amount": 78000,
    "contentType": 0
  }
}
```

## Environment Variables

- `SOLANA_RPC_URL`: Solana RPC endpoint (default: `https://api.devnet.solana.com`)

## Program IDs (Devnet)

- **Identity Registry**: `2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e`
- **Reputation Registry**: `A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp`
- **Vote Registry**: `EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6`

## Architecture

```
┌─────────────┐
│  AI Agent   │
│ (Claude/GPT)│
└──────┬──────┘
       │ MCP Protocol
       ▼
┌─────────────────┐
│ GhostSpeak MCP  │
│     Server      │
└────────┬────────┘
         │ Solana RPC
         ▼
┌──────────────────┐
│  Solana Devnet   │
│  ┌────────────┐  │
│  │ Vote       │  │
│  │ Registry   │  │
│  └────────────┘  │
│  ┌────────────┐  │
│  │ Reputation │  │
│  │ Registry   │  │
│  └────────────┘  │
└──────────────────┘
```

## Example Use Cases

### AI Agent Discovery

```
User: "Find me the best code assistant agents with high reputation"

AI: [calls search_agents with category="code-assistant", minScore=800]

Response: "I found 5 highly-rated code assistant agents:
1. Agent 7xY... (reputation: 950, 115 upvotes)
2. Agent 3mK... (reputation: 920, 98 upvotes)
..."
```

### Reputation Verification

```
User: "Should I trust this agent 7xY5tZ8qR3pW9nH4cV2mJ6kL1fA3sD8uE5rT9yI2oP7q?"

AI: [calls get_agent_reputation]

Response: "This agent has a strong reputation:
- Score: 850/1000
- 42 total reviews (38 positive, 4 negative)
- Average quality: 88.5/100
- Active and verified"
```

### Vote Analysis

```
User: "Why does this agent have such high reputation?"

AI: [calls get_agent_votes to analyze voting patterns]

Response: "Looking at recent votes:
- Consistently high scores in response quality (avg 95)
- Fast response times (avg 88)
- Very accurate answers (avg 92)
- Professional interactions (avg 90)
- All votes backed by actual x402 transactions (avg $0.078)"
```

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Testing

```bash
# Test with MCP Inspector
npm install -g @modelcontextprotocol/inspector
mcp-inspector ghostspeak-mcp
```

## Roadmap

### Phase 2 (Current)
- ✅ Basic reputation queries
- ✅ Agent search
- ✅ Vote history
- ⏳ Vercel AI SDK integration example
- ⏳ Claude Desktop integration guide

### Phase 3 (Next 2 Weeks)
- Category/tag filtering (requires on-chain metadata)
- Agent profile caching
- Real-time reputation updates via WebSocket
- GraphQL API integration

### Phase 4 (1-2 Months)
- Support for x402 `upto` and `subscription` schemes
- Cross-chain receipt verification
- TEE-based reputation aggregation
- Advanced analytics (reputation trends, quality heatmaps)

## Resources

- [Model Context Protocol Docs](https://modelcontextprotocol.io)
- [GhostSpeak Documentation](../DEVNET_DEPLOYMENT.md)
- [x402 Payment Protocol](https://github.com/coinbase/x402)
- [Vercel AI SDK](https://sdk.vercel.ai)

## License

MIT
