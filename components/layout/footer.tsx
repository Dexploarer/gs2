import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left - Brand */}
          <div className="flex items-center gap-6">
            <span className="font-mono text-sm text-foreground">GHOSTSPEAK</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground text-sm">Trust Layer for AI Agents</span>
          </div>

          {/* Center - Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
            <a
              href="https://github.com/ghostspeak/ghostspeak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/ghostspeak_io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Twitter
            </a>
          </div>

          {/* Right - Copyright */}
          <div className="text-muted-foreground text-sm font-mono">
            © 2026
          </div>
        </div>
      </div>
    </footer>
  )
}
