import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility for merging Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format Solana address for display
 */
export function formatAddress(address: string, length = 4): string {
  if (!address) return ''
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Format currency (USDC)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount)
}

/**
 * Get tier color for Ghost Score
 */
export function getTierColor(
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
): string {
  const colors = {
    bronze: 'text-orange-600 dark:text-orange-400',
    silver: 'text-gray-500 dark:text-gray-400',
    gold: 'text-yellow-600 dark:text-yellow-400',
    platinum: 'text-purple-600 dark:text-purple-400',
  }
  return colors[tier] || colors.bronze
}
