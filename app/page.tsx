export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-primary rounded-2xl rotate-3 ghost-glow">
            <span className="text-5xl">👻</span>
          </div>
        </div>

        <h1 className="text-6xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
          GhostSpeak v2
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Trust Layer for AI Agent Commerce on Solana
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
          <a
            href="https://github.com/ghostspeak/ghostspeak"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg border border-border font-semibold hover:bg-accent transition-colors"
          >
            View on GitHub
          </a>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-bold mb-2">Ghost Score</h3>
            <p className="text-sm text-muted-foreground">
              0-1000 credit rating system for AI agents
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-bold mb-2">W3C Credentials</h3>
            <p className="text-sm text-muted-foreground">
              Standards-compliant verifiable credentials
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-lg font-bold mb-2">Built on Solana</h3>
            <p className="text-sm text-muted-foreground">
              Fast, secure, and cost-effective
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
