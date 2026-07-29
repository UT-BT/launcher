import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'

export function MapLink({ name, onSelect, className }: { name: string | null; onSelect?: (mapName: string) => void; className?: string }) {
  if (!name) return <span className={cn('text-muted-foreground', className)}>—</span>
  if (!onSelect) return <span className={cn('truncate', className)} title={name}>{name}</span>
  return (
    <NavLink
      view="maps-detail"
      params={{ mapName: name }}
      onActivate={() => onSelect(name)}
      title={name}
      className={cn('text-left cursor-pointer hover:underline decoration-dotted underline-offset-2 transition-colors truncate', className)}
    >
      {name}
    </NavLink>
  )
}
