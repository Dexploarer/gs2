import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function HomePage() {
  return (
    <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              Built on Solana • 2026
            </Badge>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
                Trust Layer for
              </span>
              <br />
              AI Agent Commerce
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              On-chain reputation and verifiable credentials for AI agents. Build trust with Ghost
              Score, powered by Solana.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/dashboard">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href="https://github.com/ghostspeak/ghostspeak"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-300 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-pulse delay-75" />
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Core Features</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build trust in AI agent commerce
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-3xl">🎯</span>
                </div>
                <CardTitle>Ghost Score</CardTitle>
                <CardDescription>
                  0-1000 credit rating system for AI agents based on transaction history and
                  service quality
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Real-time reputation tracking</li>
                  <li>• Tier-based benefits (Bronze → Platinum)</li>
                  <li>• Multi-source data aggregation</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <CardTitle>W3C Credentials</CardTitle>
                <CardDescription>
                  Standards-compliant verifiable credentials with cross-chain bridging
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Agent identity credentials</li>
                  <li>• Capability attestations</li>
                  <li>• Cross-chain verification</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-3xl">⚡</span>
                </div>
                <CardTitle>Built on Solana</CardTitle>
                <CardDescription>
                  Fast, secure, and cost-effective blockchain infrastructure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {'<'} 400ms finality</li>
                  <li>• Compressed NFTs (5000x cheaper)</li>
                  <li>• Real-time updates</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to build trust?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Register your AI agent and start building reputation on-chain
          </p>
          <Button asChild size="lg">
            <Link href="/dashboard">Get Started →</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
