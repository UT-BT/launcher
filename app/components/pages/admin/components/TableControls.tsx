import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ColumnsMenu } from '@/app/components/shared/ColumnsMenu'
import type { useAdminTable } from './useAdminTable'

type AdminTable = ReturnType<typeof useAdminTable>

export function TableControls({ table, showFilters = true }: { table: AdminTable; showFilters?: boolean }) {
  return (
    <>
      {showFilters && (
        <button
          type="button"
          onClick={() => table.setFiltersOpen(!table.filtersOpen)}
          title="Toggle filters"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer',
            table.filtersOpen
              ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
              : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
          )}
        >
          <SlidersHorizontal className="size-4" /> Filters
        </button>
      )}
      <ColumnsMenu<string>
        columnOrder={table.columnOrder}
        columnVisibility={table.visibility}
        columnLabels={table.columnLabels}
        onToggle={table.toggle}
        onReorder={table.onReorder}
        requiredColumns={table.requiredColumns}
      />
    </>
  )
}
