import { AppNavigation } from '@/components/layout/app-navigation'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNavigation />
      <main>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>GHOSTSPEAK © 2026</span>
            <span>
              SYSTEM STATUS: <span className="text-green-600">●</span> OPERATIONAL
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
