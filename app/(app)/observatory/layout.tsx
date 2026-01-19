import { Navigation } from '@/components/layout/navigation'

// Force dynamic rendering for observatory pages (Convex real-time queries)
export const dynamic = 'force-dynamic'

/**
 * Observatory layout
 */
export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
    </div>
  )
}
