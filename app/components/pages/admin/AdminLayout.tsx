import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ADMIN_GROUPS } from './registry'
import type { AdminSection, AdminSectionId } from './types'

interface AdminLayoutProps {
  sections: AdminSection[]
  activeSection: AdminSectionId
  onSectionChange: (id: AdminSectionId) => void
  children: ReactNode
}

export function AdminLayout({ sections, activeSection, onSectionChange, children }: AdminLayoutProps) {
  const groups = ADMIN_GROUPS
    .map((g) => ({ ...g, items: sections.filter((s) => s.group === g.id) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-1">
      <aside className="w-64 shrink-0 sticky top-0 self-start max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar border-r border-hairline/10 pr-4 pt-1 space-y-8">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="mb-3 px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <item.icon className={cn('size-4.5 transition-transform duration-200', activeSection === item.id && 'scale-110')} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <main className="flex-1 min-w-0 overflow-x-clip">
        <div className="w-full pl-6 lg:pl-8 pr-1 pt-1 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
