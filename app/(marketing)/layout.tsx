import { Navigation } from '@/components/layout/navigation'
import { Footer } from '@/components/layout/footer'

/**
 * Marketing layout (for landing page and public pages)
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
