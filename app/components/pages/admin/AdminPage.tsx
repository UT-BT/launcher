import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { isStaff, ADMIN_DASHBOARD_ROLES } from '@/app/utils/roles'
import type { UserProfile } from '@/app/utils/api'
import { AdminLayout } from './AdminLayout'
import { AdminGuard } from './AdminGuard'
import { visibleSections, findSection, firstVisibleSection } from './registry'
import { DEFAULT_ADMIN_STATE, type AdminPageState, type AdminSectionId } from './types'

export { DEFAULT_ADMIN_STATE }
export type { AdminPageState }

interface AdminPageProps {
  state: AdminPageState
  onStateChange: Dispatch<SetStateAction<AdminPageState>>
  userProfile?: UserProfile
  forceDenied?: boolean
  onMapSelect?: (mapName: string) => void
}

export function AdminPage({ state, onStateChange, userProfile, forceDenied, onMapSelect }: AdminPageProps) {
  const role = userProfile?.utbt_role ?? 0
  const denied = forceDenied || !isStaff(userProfile)

  const active = findSection(state.activeSection)
  const activeVisible = !!active && active.roles.includes(role)

  useEffect(() => {
    if (denied || activeVisible) return
    const fallback = firstVisibleSection(role)
    if (fallback && fallback.id !== state.activeSection) {
      onStateChange((prev) => ({ ...prev, activeSection: fallback.id }))
    }
  }, [denied, activeVisible, role, state.activeSection, onStateChange])

  const setSection = (id: AdminSectionId) => onStateChange((prev) => ({ ...prev, activeSection: id }))

  if (denied) {
    return (
      <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-0 duration-500">
        <AdminGuard role={role} allowedRoles={ADMIN_DASHBOARD_ROLES} fullPage />
      </div>
    )
  }

  const current = activeVisible && active ? active : firstVisibleSection(role)
  const Section = current?.Component

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-0 duration-500">
      <AdminLayout
        sections={visibleSections(role)}
        activeSection={current?.id ?? state.activeSection}
        onSectionChange={setSection}
      >
        {current && Section && (
          <AdminGuard role={role} allowedRoles={current.roles}>
            <Section userProfile={userProfile} onNavigate={setSection} onMapSelect={onMapSelect} />
          </AdminGuard>
        )}
      </AdminLayout>
    </div>
  )
}
