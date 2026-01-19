import { Navigation } from '@/components/layout/navigation'

/**
 * Database layout
 */
export default function DatabaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      {children}
    </div>
  )
}
