// Server component wrapper for dynamic rendering
// Convex queries require client-side rendering
export const dynamic = 'force-dynamic'

import { DatabasePageClient } from './database-page'

export default function DatabasePage() {
  return <DatabasePageClient />
}
