/**
 * Convex Context Mock
 *
 * Provides a mock Convex database context for testing Convex functions
 * without a real Convex deployment.
 */
import { vi } from 'vitest'

// Type for mock database storage
type MockDB = Map<string, Map<string, unknown>>

// Generate unique IDs
let idCounter = 0
export function generateId(table: string): string {
  return `${table}_${++idCounter}_${Date.now()}`
}

// Reset ID counter between tests
export function resetIdCounter(): void {
  idCounter = 0
}

/**
 * Create a mock Convex query builder
 */
function createQueryBuilder(db: MockDB, table: string) {
  let filters: Array<(item: unknown) => boolean> = []
  let orderDirection: 'asc' | 'desc' = 'asc'
  let limitCount: number | null = null

  const builder = {
    withIndex: (_indexName: string, fn: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
      // Extract the filter from the index query
      let filterField: string | null = null
      let filterValue: unknown = null

      fn({
        eq: (field: string, value: unknown) => {
          filterField = field
          filterValue = value
          return value
        },
      })

      if (filterField) {
        const field = filterField
        const value = filterValue
        filters.push((item: unknown) => {
          const record = item as Record<string, unknown>
          return record[field] === value
        })
      }

      return builder
    },

    filter: (fn: ((item: unknown) => boolean) | ((q: { eq: (a: unknown, b: unknown) => boolean }) => boolean)) => {
      filters.push((item: unknown) => {
        // Check if it's a simple predicate function (takes item as argument)
        // or a Convex-style filter (takes query builder)
        try {
          // Try calling with the item directly (simple predicate)
          const result = fn(item)
          if (typeof result === 'boolean') {
            return result
          }
        } catch {
          // If that fails, try the Convex-style filter
        }

        // Try Convex-style filter
        return fn({
          eq: (a: unknown, b: unknown) => a === b,
        } as unknown as Parameters<typeof fn>[0]) as boolean
      })
      return builder
    },

    order: (direction: 'asc' | 'desc') => {
      orderDirection = direction
      return builder
    },

    take: (count: number) => {
      limitCount = count
      return builder
    },

    first: async () => {
      const results = await builder.collect()
      return results[0] || null
    },

    unique: async () => {
      const results = await builder.collect()
      if (results.length > 1) {
        throw new Error('Expected unique result but found multiple')
      }
      return results[0] || null
    },

    collect: async () => {
      const tableData = db.get(table) || new Map()
      let results = Array.from(tableData.values())

      // Apply filters
      for (const filter of filters) {
        results = results.filter(filter)
      }

      // Apply ordering (by _creationTime)
      results.sort((a, b) => {
        const aTime = (a as Record<string, unknown>)._creationTime as number || 0
        const bTime = (b as Record<string, unknown>)._creationTime as number || 0
        return orderDirection === 'asc' ? aTime - bTime : bTime - aTime
      })

      // Apply limit
      if (limitCount !== null) {
        results = results.slice(0, limitCount)
      }

      return results
    },

    // Make the builder thenable so it can be awaited directly
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown
    ) => {
      return builder.collect().then(resolve, reject)
    },
  }

  return builder
}

/**
 * Create a mock Convex context for testing
 */
export function createMockConvexContext() {
  const db: MockDB = new Map()

  return {
    db: {
      query: (table: string) => createQueryBuilder(db, table),

      get: async (table: string, id: string) => {
        const tableData = db.get(table)
        if (!tableData) return null
        return tableData.get(id) || null
      },

      insert: async (table: string, data: Record<string, unknown>) => {
        if (!db.has(table)) {
          db.set(table, new Map())
        }
        const tableData = db.get(table)!
        const id = generateId(table)
        const record = {
          ...data,
          _id: id,
          _creationTime: Date.now(),
        }
        tableData.set(id, record)
        return id
      },

      patch: async (table: string, id: string, data: Record<string, unknown>) => {
        const tableData = db.get(table)
        if (!tableData) throw new Error(`Table ${table} not found`)
        const existing = tableData.get(id)
        if (!existing) throw new Error(`Record ${id} not found in ${table}`)
        const updated = { ...existing as Record<string, unknown>, ...data }
        tableData.set(id, updated)
      },

      replace: async (table: string, id: string, data: Record<string, unknown>) => {
        const tableData = db.get(table)
        if (!tableData) throw new Error(`Table ${table} not found`)
        const existing = tableData.get(id) as Record<string, unknown>
        if (!existing) throw new Error(`Record ${id} not found in ${table}`)
        const replaced = {
          ...data,
          _id: id,
          _creationTime: existing._creationTime,
        }
        tableData.set(id, replaced)
      },

      delete: async (table: string, id: string) => {
        const tableData = db.get(table)
        if (!tableData) return
        tableData.delete(id)
      },
    },

    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(null),
    },

    scheduler: {
      runAfter: vi.fn(),
      runAt: vi.fn(),
    },

    storage: {
      getUrl: vi.fn().mockResolvedValue('https://example.com/file.png'),
      store: vi.fn().mockResolvedValue('storage_id_123'),
    },

    // Helper to run internal mutations/queries
    runMutation: vi.fn(),
    runQuery: vi.fn(),
    runAction: vi.fn(),
  }
}

/**
 * Mock fetchQuery for API route testing
 */
export const mockFetchQuery = vi.fn()

/**
 * Mock fetchMutation for API route testing
 */
export const mockFetchMutation = vi.fn()

/**
 * Setup Convex mocks for API route testing
 */
export function setupConvexMocks() {
  vi.mock('convex/nextjs', () => ({
    fetchQuery: mockFetchQuery,
    fetchMutation: mockFetchMutation,
  }))
}

/**
 * Reset all Convex mocks
 */
export function resetConvexMocks() {
  mockFetchQuery.mockReset()
  mockFetchMutation.mockReset()
  resetIdCounter()
}

/**
 * Seed mock database with initial data
 */
export function seedMockDB(
  ctx: ReturnType<typeof createMockConvexContext>,
  table: string,
  records: Record<string, unknown>[]
): string[] {
  const ids: string[] = []
  for (const record of records) {
    const id = ctx.db.insert(table, record)
    if (id instanceof Promise) {
      // Handle async - this is a simplification for seeding
    } else {
      ids.push(id as unknown as string)
    }
  }
  return ids
}
