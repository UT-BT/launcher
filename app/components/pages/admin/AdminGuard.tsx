import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminGuardProps {
  role: number
  allowedRoles: number[]
  fullPage?: boolean
  children?: ReactNode
}

export function AdminGuard({ role, allowedRoles, fullPage, children }: AdminGuardProps) {
  if (allowedRoles.includes(role)) return <>{children}</>
  return (
    <div className={cn('flex items-center justify-center', fullPage ? 'h-full' : 'py-20')}>
      <div className="text-center max-w-sm">
        <ShieldAlert className="size-12 text-muted-foreground/20 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-foreground">Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this section.</p>
      </div>
    </div>
  )
}
