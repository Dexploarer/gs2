// Server component wrapper for dynamic rendering
// Convex queries require client-side rendering
export const dynamic = 'force-dynamic'

import { StakingPageClient } from './staking-page'

export default function StakingPage() {
  return <StakingPageClient />
}
