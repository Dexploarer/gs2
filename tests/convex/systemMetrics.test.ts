/**
 * Integration Tests: Convex System Metrics
 *
 * Tests system metrics functions against real Convex data
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { hasConvexCredentials, skipWithoutConvex } from '../setup'

// Get real Convex URL
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

// Real Convex client
let convex: ConvexHttpClient | null = null

describe('Convex System Metrics', () => {
  beforeAll(() => {
    if (hasConvexCredentials && convexUrl) {
      convex = new ConvexHttpClient(convexUrl)
    }
  })

  describe('getByType', () => {
    it.skipIf(skipWithoutConvex)('returns latency metrics', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const metrics = await convex.query(api.systemMetrics.getByType, {
        metricType: 'latency',
        limit: 10,
      })

      expect(Array.isArray(metrics)).toBe(true)

      if (metrics.length > 0) {
        expect(metrics[0]).toHaveProperty('metricType')
        expect(metrics[0].metricType).toBe('latency')
        expect(metrics[0]).toHaveProperty('value')
        expect(metrics[0]).toHaveProperty('timestamp')
      }
    })

    it.skipIf(skipWithoutConvex)('returns throughput metrics', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const metrics = await convex.query(api.systemMetrics.getByType, {
        metricType: 'throughput',
        limit: 10,
      })

      expect(Array.isArray(metrics)).toBe(true)

      metrics.forEach((m) => {
        expect(m.metricType).toBe('throughput')
      })
    })

    it.skipIf(skipWithoutConvex)('filters by network', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const solanaMetrics = await convex.query(api.systemMetrics.getByType, {
        metricType: 'latency',
        network: 'solana',
        limit: 10,
      })

      expect(Array.isArray(solanaMetrics)).toBe(true)

      solanaMetrics.forEach((m) => {
        expect(m.network).toBe('solana')
      })

      const baseMetrics = await convex.query(api.systemMetrics.getByType, {
        metricType: 'latency',
        network: 'base',
        limit: 10,
      })

      expect(Array.isArray(baseMetrics)).toBe(true)

      baseMetrics.forEach((m) => {
        expect(m.network).toBe('base')
      })
    })

    it.skipIf(skipWithoutConvex)('respects limit parameter', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const metrics = await convex.query(api.systemMetrics.getByType, {
        metricType: 'latency',
        limit: 5,
      })

      expect(metrics.length).toBeLessThanOrEqual(5)
    })
  })

  describe('getLatest', () => {
    it.skipIf(skipWithoutConvex)('returns latest metrics for all types', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const metrics = await convex.query(api.systemMetrics.getLatest, {})

      expect(Array.isArray(metrics)).toBe(true)
      expect(metrics.length).toBe(5) // 5 metric types

      const types = metrics.map((m) => m.type)
      expect(types).toContain('latency')
      expect(types).toContain('throughput')
      expect(types).toContain('errorRate')
      expect(types).toContain('networkFinality')
      expect(types).toContain('facilitatorUptime')
    })

    it.skipIf(skipWithoutConvex)('filters by network', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const solanaMetrics = await convex.query(api.systemMetrics.getLatest, {
        network: 'solana',
      })

      expect(Array.isArray(solanaMetrics)).toBe(true)
      expect(solanaMetrics.length).toBe(5)
    })

    it.skipIf(skipWithoutConvex)('returns valid values', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const metrics = await convex.query(api.systemMetrics.getLatest, {})

      metrics.forEach((m) => {
        expect(typeof m.value).toBe('number')
        expect(typeof m.timestamp).toBe('number')
        expect(m.value).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('getSystemHealth', () => {
    it.skipIf(skipWithoutConvex)('returns system health status', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const health = await convex.query(api.systemMetrics.getSystemHealth, {})

      expect(health).toBeDefined()
      expect(health).toHaveProperty('status')
      expect(['operational', 'degraded', 'offline']).toContain(health.status)
      expect(typeof health.avgLatency).toBe('number')
      expect(typeof health.errorRate).toBe('number')
      expect(typeof health.activeAlerts).toBe('number')
    })
  })

  describe('getNetworkMetrics', () => {
    it.skipIf(skipWithoutConvex)('returns solana network metrics', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const metrics = await convex.query(api.systemMetrics.getNetworkMetrics, {
        network: 'solana',
      })

      expect(metrics).toBeDefined()
      expect(typeof metrics.tps).toBe('number')
      expect(typeof metrics.uptime).toBe('number')
      expect(typeof metrics.finality).toBe('number')
    })

    it.skipIf(skipWithoutConvex)('returns base network metrics', async () => {
      if (!convex) throw new Error('Convex client not initialized')

      const metrics = await convex.query(api.systemMetrics.getNetworkMetrics, {
        network: 'base',
      })

      expect(metrics).toBeDefined()
      expect(typeof metrics.tps).toBe('number')
      expect(typeof metrics.uptime).toBe('number')
      expect(typeof metrics.finality).toBe('number')
    })
  })
})
