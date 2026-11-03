import type { ReactNode } from 'react'
import type { ResponsiveColumn } from '@/app/components/shared/DataTable'
import { cn } from '@/lib/utils'

export function AdminCardFace<Row>({ columns, row, lead }: {
  columns: readonly ResponsiveColumn<Row>[]
  row: Row
  lead?: ReactNode
}) {
  const essential = columns.filter((c) => c.tier === 'essential')
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {lead}
      {essential.map((c, i) => (
        <div key={c.id} className={cn('min-w-0', i === essential.length - 1 && i > 0 && 'ml-auto')}>
          {c.cell?.(row)}
        </div>
      ))}
    </div>
  )
}

export function adminCardsPlaceholder(loading: boolean, empty: boolean, message: string): ReactNode {
  if (loading && empty) {
    return Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 mx-3 my-2 rounded-lg bg-hairline/5 animate-pulse" />)
  }
  if (empty) return <div className="px-4 py-16 text-center text-muted-foreground">{message}</div>
  return undefined
}
