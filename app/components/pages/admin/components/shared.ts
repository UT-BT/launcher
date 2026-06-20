import { useEffect, useRef } from 'react'
import { useAutoPageSize } from '@/app/hooks/useAutoPageSize'

export const PANEL_LABEL = 'text-[10px] uppercase tracking-wider text-muted-foreground font-medium'

const ADMIN_ROW_HEIGHT_PX = 56
const ADMIN_TABLE_CHROME_PX = 320
const ADMIN_PAGE_MIN_ROWS = 10
const ADMIN_PAGE_MAX_ROWS = 50
const ADMIN_PAGE_STEP = 5

export function computeAdminPageSize(): number {
  if (typeof window === 'undefined') return 25
  const usable = Math.max(window.innerHeight - ADMIN_TABLE_CHROME_PX, ADMIN_ROW_HEIGHT_PX * ADMIN_PAGE_MIN_ROWS)
  const rows = Math.floor(usable / ADMIN_ROW_HEIGHT_PX)
  const stepped = Math.floor(rows / ADMIN_PAGE_STEP) * ADMIN_PAGE_STEP
  return Math.min(ADMIN_PAGE_MAX_ROWS, Math.max(ADMIN_PAGE_MIN_ROWS, stepped))
}

export function useAdminPageSize(): number {
  return useAutoPageSize(computeAdminPageSize)
}

export function useResetOnChange(reset: () => void, deps: unknown[]): void {
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
