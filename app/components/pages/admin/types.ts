import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { UserProfile } from '@/app/utils/api'

export type Tone = 'accent' | 'emerald' | 'red' | 'amber'

export type AdminGroupId = 'overview' | 'community' | 'game-content' | 'integrity' | 'system'

export type AdminSectionId =
  | 'overview'
  | 'title-management'
  | 'user-management'
  | 'news-management'
  | 'caps-management'
  | 'maps-management'
  | 'patches-management'
  | 'anti-cheat'
  | 'audit-logs'

export interface AdminSectionProps {
  userProfile?: UserProfile
  onNavigate?: (section: AdminSectionId) => void
  onMapSelect?: (mapName: string) => void
}

export interface AdminSection {
  id: AdminSectionId
  label: string
  icon: LucideIcon
  group: AdminGroupId
  roles: number[]
  Component: ComponentType<AdminSectionProps>
}

export interface AdminGroup {
  id: AdminGroupId
  title: string
}

export interface AdminPageState {
  activeSection: AdminSectionId
}

export const DEFAULT_ADMIN_STATE: AdminPageState = { activeSection: 'overview' }
