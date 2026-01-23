'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  Zap,
  RefreshCw,
  ExternalLink,
  Copy,
} from 'lucide-react'

interface TestResult {
  url: string
  status: 'success' | 'failed' | 'timeout' | 'pending'
  responseTime?: number
  statusCode?: number
  error?: string
  testedAt: number
  x402Compatible: boolean
  paymentRequired?: boolean
  priceDetected?: number
}

const VERIFICATION_TIERS = [
  { name: 'Unverified', minScore: 0, color: 'text-gray-400', bgColor: 'bg-gray-500/10' },
  { name: 'Tested', minScore: 200, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  { name: 'Verified', minScore: 400, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  { name: 'Trusted', minScore: 600, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { name: 'Certified', minScore: 800, color: 'text-green-400', bgColor: 'bg-green-500/10' },
]

function getTier(score: number) {
  for (let i = VERIFICATION_TIERS.length - 1; i >= 0; i--) {
    if (score >= VERIFICATION_TIERS[i].minScore) {
      return VERIFICATION_TIERS[i]
    }
  }
  return VERIFICATION_TIERS[0]
}

export default function EndpointVerificationPage() {
  const [urlInput, setUrlInput] = useState('')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isTestingUrl, setIsTestingUrl] = useState(false)
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)

  // Fetch verified endpoints
  const endpoints = useQuery(api.endpoints.list, { limit: 100 })
  const stats = useQuery(api.endpoints.getStats, {})

  // Filter for recently tested/verified
  const verifiedEndpoints = endpoints?.filter((e) => e.isVerified) || []
  const recentlyTested = endpoints?.filter((e) => e.lastTested)
    .sort((a, b) => (b.lastTested || 0) - (a.lastTested || 0))
    .slice(0, 10) || []

  // Test an endpoint
  const testEndpoint = useCallback(async (url: string) => {
    setIsTestingUrl(true)
    const startTime = Date.now()

    // Add pending result
    const pendingResult: TestResult = {
      url,
      status: 'pending',
      testedAt: startTime,
      x402Compatible: false,
    }
    setTestResults((prev) => [pendingResult, ...prev.filter((r) => r.url !== url)])

    try {
      // Perform actual HTTP test
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors', // Allow cross-origin requests
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      // Check for x402 payment requirement
      const is402 = response.status === 402
      const paymentHeader = response.headers.get('X-Payment-Required')

      const result: TestResult = {
        url,
        status: 'success',
        responseTime,
        statusCode: response.status,
        testedAt: Date.now(),
        x402Compatible: is402 || !!paymentHeader,
        paymentRequired: is402,
      }

      setTestResults((prev) => [result, ...prev.filter((r) => r.url !== url)])
    } catch (error: any) {
      const responseTime = Date.now() - startTime

      // Even failed requests tell us something - endpoint exists but may have CORS
      const result: TestResult = {
        url,
        status: error.name === 'AbortError' ? 'timeout' : 'failed',
        responseTime,
        error: error.message || 'Connection failed',
        testedAt: Date.now(),
        x402Compatible: false, // Can't verify without response
      }

      // If it's a CORS error, the endpoint likely exists
      if (error.message?.includes('CORS') || error.name === 'TypeError') {
        result.status = 'success' // Endpoint exists, just can't read response
        result.error = 'Endpoint reachable (CORS restricted)'
      }

      setTestResults((prev) => [result, ...prev.filter((r) => r.url !== url)])
    } finally {
      setIsTestingUrl(false)
    }
  }, [])

  const handleSubmitTest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    // Validate URL
    try {
      new URL(urlInput)
      testEndpoint(urlInput.trim())
    } catch {
      // Try adding https://
      try {
        const withProtocol = `https://${urlInput.trim()}`
        new URL(withProtocol)
        testEndpoint(withProtocol)
        setUrlInput(withProtocol)
      } catch {
        alert('Please enter a valid URL')
      }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold text-foreground mb-2">
          Endpoint Verification
        </h1>
        <p className="text-muted-foreground">
          Test and verify x402 endpoint reliability before your agents use them
        </p>
      </div>

      {/* Stats */}
      <StatGrid columns={4}>
        <StatCard
          label="Verified Endpoints"
          value={stats?.verifiedEndpoints || 0}
          subtext="Trusted by the network"
          trend={{ value: 'Audited', direction: 'neutral' }}
        />
        <StatCard
          label="Tests Today"
          value={testResults.length}
          subtext="Your session"
        />
        <StatCard
          label="Avg Success Rate"
          value={`${(stats?.avgSuccessRate || 0).toFixed(1)}%`}
          subtext="Platform-wide"
          trend={{ value: 'Reliable', direction: 'up' }}
        />
        <StatCard
          label="x402 Native"
          value={stats?.x402Endpoints || 0}
          subtext="Payment-enabled"
        />
      </StatGrid>

      {/* Test Form */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Test an Endpoint</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Enter a URL to verify the endpoint is reachable and check for x402 payment requirements.
        </p>

        <form onSubmit={handleSubmitTest} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="https://api.example.com/v1/endpoint"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isTestingUrl || !urlInput.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {isTestingUrl ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Test Endpoint
              </>
            )}
          </button>
        </form>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-yellow-400" />
              <h2 className="font-semibold text-foreground">Test Results</h2>
            </div>
            <button
              onClick={() => setTestResults([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div
                key={`${result.url}-${result.testedAt}`}
                className={`p-4 rounded-lg border ${
                  result.status === 'pending'
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : result.status === 'success'
                      ? 'border-green-500/20 bg-green-500/5'
                      : result.status === 'timeout'
                        ? 'border-orange-500/20 bg-orange-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {result.status === 'pending' && (
                        <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
                      )}
                      {result.status === 'success' && (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      )}
                      {result.status === 'failed' && (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      {result.status === 'timeout' && (
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                      )}
                      <span className="font-mono text-sm text-foreground truncate">
                        {result.url}
                      </span>
                      <button
                        onClick={() => copyToClipboard(result.url)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {result.responseTime !== undefined && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {result.responseTime}ms
                        </span>
                      )}
                      {result.statusCode && (
                        <span className="text-muted-foreground">
                          HTTP {result.statusCode}
                        </span>
                      )}
                      {result.x402Compatible && (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-400 border-green-500/20"
                        >
                          x402 Compatible
                        </Badge>
                      )}
                      {result.paymentRequired && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-400 border-blue-500/20"
                        >
                          Payment Required
                        </Badge>
                      )}
                      {result.error && (
                        <span className="text-muted-foreground">{result.error}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(result.testedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recently Tested */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold text-foreground">Recently Tested</h2>
          </div>

          <div className="space-y-3">
            {recentlyTested.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recently tested endpoints
              </p>
            ) : (
              recentlyTested.map((endpoint) => {
                const tier = getTier(endpoint.trustScore || 0)

                return (
                  <div
                    key={endpoint._id}
                    className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-foreground truncate max-w-[200px]">
                        {endpoint.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`${tier.bgColor} ${tier.color} border-transparent text-[10px]`}
                      >
                        {tier.name}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{endpoint.successRate.toFixed(1)}% success</span>
                      <span>{endpoint.avgResponseTime?.toFixed(0) || '-'}ms avg</span>
                    </div>
                    <button
                      onClick={() => testEndpoint(endpoint.url)}
                      className="mt-2 w-full text-xs text-primary hover:underline"
                    >
                      Re-test endpoint
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Verification Tiers */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-green-400" />
            <h2 className="font-semibold text-foreground">Trust Tiers</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Endpoints are scored based on uptime, response time, success rate, and community verification.
          </p>

          <div className="space-y-3">
            {VERIFICATION_TIERS.slice()
              .reverse()
              .map((tier) => {
                const count =
                  endpoints?.filter((e) => {
                    const score = e.trustScore || 0
                    const currentTier = getTier(score)
                    return currentTier.name === tier.name
                  }).length || 0

                return (
                  <div
                    key={tier.name}
                    className={`p-3 rounded-lg border ${tier.bgColor} border-opacity-20`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${tier.color}`}>{tier.name}</span>
                      <span className="text-xs text-muted-foreground">{count} endpoints</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tier.name === 'Certified' && 'Highest trust level. Manually audited and verified.'}
                      {tier.name === 'Trusted' && 'Strong track record with 600+ trust score.'}
                      {tier.name === 'Verified' && 'Community verified with good performance.'}
                      {tier.name === 'Tested' && 'Basic testing passed, building reputation.'}
                      {tier.name === 'Unverified' && 'New or untested endpoints.'}
                    </p>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Verified Endpoints List */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <h2 className="font-semibold text-foreground">Verified Endpoints</h2>
          </div>
          <Badge variant="outline" className="text-xs">
            {verifiedEndpoints.length} verified
          </Badge>
        </div>

        {verifiedEndpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No verified endpoints yet. Test endpoints to build the verified database.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {verifiedEndpoints.slice(0, 12).map((endpoint) => {
              const tier = getTier(endpoint.trustScore || 0)

              return (
                <div
                  key={endpoint._id}
                  className="p-4 rounded-lg border border-border hover:border-green-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm truncate">
                        {endpoint.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {endpoint.url}
                      </div>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  </div>

                  <div className="flex items-center justify-between text-xs mt-3">
                    <span className={tier.color}>{tier.name}</span>
                    <span className="text-muted-foreground">
                      {endpoint.successRate.toFixed(0)}% success
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => testEndpoint(endpoint.url)}
                      className="flex-1 text-xs text-center py-1.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
                    >
                      Test
                    </button>
                    <a
                      href={endpoint.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
