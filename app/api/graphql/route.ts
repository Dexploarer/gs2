/**
 * GraphQL API Route for Next.js 15.4 App Router
 *
 * 2026 Best Practices:
 * - GraphQL Yoga v5 (lightweight, modern)
 * - Bun-native performance
 * - TypeScript strict mode
 * - GraphQL Playground in development
 */

import { createSchema, createYoga } from 'graphql-yoga';
import { typeDefs } from './schema';
import { resolvers } from './resolvers-fast';

const { handleRequest } = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),

  // GraphQL endpoint
  graphqlEndpoint: '/api/graphql',

  // Enable GraphiQL in development
  graphiql: process.env.NODE_ENV === 'development',

  // Fetch API integration (Next.js App Router)
  fetchAPI: { Response, Request },

  // CORS configuration
  cors: {
    origin: process.env.NODE_ENV === 'development' ? '*' : process.env.NEXT_PUBLIC_APP_URL,
    credentials: true,
  },

  // Logging
  logging: process.env.NODE_ENV === 'development',
});

// Next.js App Router route handlers
export async function GET(request: Request) {
  return handleRequest(request, {});
}

export async function POST(request: Request) {
  return handleRequest(request, {});
}

export async function OPTIONS(request: Request) {
  return handleRequest(request, {});
}
