'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'

interface Column<T> {
    key: keyof T | string
    header: string
    width?: string
    render?: (item: T, index: number) => React.ReactNode
    sortable?: boolean
}

interface DataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    keyExtractor: (item: T, index: number) => string
    onRowClick?: (item: T) => void
    emptyMessage?: string
    className?: string
}

export function DataTable<T>({
    data,
    columns,
    keyExtractor,
    onRowClick,
    emptyMessage = 'No data available',
    className,
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir('asc')
        }
    }

    const sortedData = sortKey
        ? [...data].sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[sortKey]
            const bVal = (b as Record<string, unknown>)[sortKey]
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDir === 'asc' ? aVal - bVal : bVal - aVal
            }
            const aStr = String(aVal || '')
            const bStr = String(bVal || '')
            return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
        })
        : data

    if (data.length === 0) {
        return (
            <div className="p-12 text-center text-[#555] bg-[#080808] border border-white/5 rounded-xl">
                {emptyMessage}
            </div>
        )
    }

    return (
        <div className={cn('overflow-x-auto', className)}>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-white/5">
                        {columns.map((col) => (
                            <th
                                key={String(col.key)}
                                className={cn(
                                    'px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider',
                                    col.sortable && 'cursor-pointer hover:text-white transition-colors',
                                    col.width
                                )}
                                style={col.width ? { width: col.width } : undefined}
                                onClick={() => col.sortable && handleSort(String(col.key))}
                            >
                                <span className="flex items-center gap-1">
                                    {col.header}
                                    {col.sortable && sortKey === String(col.key) && (
                                        <span className="text-blue-400">
                                            {sortDir === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {sortedData.map((item, index) => (
                        <tr
                            key={keyExtractor(item, index)}
                            className={cn(
                                'group bg-[#080808] hover:bg-[#0c0c0c] transition-colors',
                                onRowClick && 'cursor-pointer'
                            )}
                            onClick={() => onRowClick?.(item)}
                        >
                            {columns.map((col) => (
                                <td
                                    key={String(col.key)}
                                    className="px-4 py-4 text-sm text-white"
                                >
                                    {col.render
                                        ? col.render(item, index)
                                        : String((item as Record<string, unknown>)[String(col.key)] || '')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// Helper components for common table cell patterns
export function AddressCell({ address, href }: { address: string; href?: string }) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`

    const content = (
        <span className="font-mono text-xs text-[#888] group-hover:text-white transition-colors">
            {truncated}
        </span>
    )

    if (href) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-blue-400"
                onClick={(e) => e.stopPropagation()}
            >
                {content}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400">↗</span>
            </a>
        )
    }

    return content
}

export function StatusCell({ status }: { status: 'active' | 'inactive' | 'pending' | 'verified' | 'unverified' }) {
    return (
        <div className="flex items-center gap-2">
            <div
                className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    status === 'active' && 'bg-green-500 animate-pulse',
                    status === 'verified' && 'bg-green-500',
                    status === 'pending' && 'bg-yellow-500 animate-pulse',
                    status === 'inactive' && 'bg-[#333]',
                    status === 'unverified' && 'bg-[#555]'
                )}
            />
            <span
                className={cn(
                    'text-xs capitalize',
                    (status === 'active' || status === 'verified') && 'text-green-400',
                    status === 'pending' && 'text-yellow-400',
                    (status === 'inactive' || status === 'unverified') && 'text-[#666]'
                )}
            >
                {status}
            </span>
        </div>
    )
}

export function BadgeCell({ text, variant = 'default' }: { text: string; variant?: 'default' | 'success' | 'warning' | 'error' }) {
    return (
        <span
            className={cn(
                'px-2 py-1 text-xs font-mono rounded',
                variant === 'default' && 'bg-[#1a1a1a] text-[#888]',
                variant === 'success' && 'bg-green-500/10 text-green-400',
                variant === 'warning' && 'bg-yellow-500/10 text-yellow-400',
                variant === 'error' && 'bg-red-500/10 text-red-400'
            )}
        >
            {text}
        </span>
    )
}
