import { LayoutDashboard, Tag, UserCog, Flag, Map as MapIcon, Package, ShieldAlert, ScrollText, Newspaper, Swords, Trophy, ShieldCheck, Activity, Server } from 'lucide-react'
import { ADMIN_DASHBOARD_ROLES, ADMIN_ONLY_ROLES } from '@/app/utils/roles'
import type { AdminSection, AdminGroup, AdminSectionId } from './types'
import { OverviewSection } from './sections/OverviewSection'
import { TitleManagementSection } from './sections/TitleManagementSection'
import { UserManagementSection } from './sections/UserManagementSection'
import { NewsManagementSection } from './sections/NewsManagementSection'
import { CapsManagementSection } from './sections/CapsManagementSection'
import { MapsManagementSection } from './sections/MapsManagementSection'
import { PatchesManagementSection } from './sections/PatchesManagementSection'
import { AntiCheatSection } from './sections/AntiCheatSection'
import { AuditLogsSection } from './sections/AuditLogsSection'
import { EventsManagementSection } from './sections/EventsManagementSection'
import { FormatsManagementSection } from './sections/FormatsManagementSection'
import { RoleManagementSection } from './sections/RoleManagementSection'
import { UsageHealthSection } from './sections/UsageHealthSection'
import { HostsManagementSection } from './sections/HostsManagementSection'

export const ADMIN_GROUPS: AdminGroup[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'community', title: 'Community' },
  { id: 'events', title: 'Events' },
  { id: 'game-content', title: 'Game Content' },
  { id: 'integrity', title: 'Integrity' },
  { id: 'system', title: 'System' },
]

export const ADMIN_SECTIONS: AdminSection[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'overview', roles: ADMIN_DASHBOARD_ROLES, Component: OverviewSection },
  { id: 'usage-health', label: 'Usage & Health', icon: Activity, group: 'overview', roles: ADMIN_DASHBOARD_ROLES, Component: UsageHealthSection },
  { id: 'user-management', label: 'User Management', icon: UserCog, group: 'community', roles: ADMIN_DASHBOARD_ROLES, Component: UserManagementSection },
  { id: 'title-management', label: 'Title Management', icon: Tag, group: 'community', roles: ADMIN_DASHBOARD_ROLES, Component: TitleManagementSection },
  { id: 'news-management', label: 'News', icon: Newspaper, group: 'community', roles: ADMIN_DASHBOARD_ROLES, Component: NewsManagementSection },
  { id: 'events-management', label: 'Events', icon: Swords, group: 'events', roles: ADMIN_DASHBOARD_ROLES, Component: EventsManagementSection },
  { id: 'formats-management', label: 'Tournament Formats', icon: Trophy, group: 'events', roles: ADMIN_DASHBOARD_ROLES, Component: FormatsManagementSection },
  { id: 'caps-management', label: 'Caps Management', icon: Flag, group: 'game-content', roles: ADMIN_DASHBOARD_ROLES, Component: CapsManagementSection },
  { id: 'maps-management', label: 'Maps Management', icon: MapIcon, group: 'game-content', roles: ADMIN_DASHBOARD_ROLES, Component: MapsManagementSection },
  { id: 'patches-management', label: 'Patch Releases', icon: Package, group: 'system', roles: ADMIN_ONLY_ROLES, Component: PatchesManagementSection },
  { id: 'anti-cheat', label: 'Anti-Cheat', icon: ShieldAlert, group: 'integrity', roles: ADMIN_DASHBOARD_ROLES, Component: AntiCheatSection },
  { id: 'audit-logs', label: 'Audit Logs', icon: ScrollText, group: 'system', roles: ADMIN_DASHBOARD_ROLES, Component: AuditLogsSection },
  { id: 'role-management', label: 'Staff Roles', icon: ShieldCheck, group: 'system', roles: ADMIN_ONLY_ROLES, Component: RoleManagementSection },
  { id: 'hosts-management', label: 'Game Hosts', icon: Server, group: 'system', roles: ADMIN_ONLY_ROLES, Component: HostsManagementSection },
]

export function visibleSections(utbtRole?: number): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => s.roles.includes(utbtRole ?? 0))
}

export function findSection(id: AdminSectionId): AdminSection | undefined {
  return ADMIN_SECTIONS.find((s) => s.id === id)
}

export function firstVisibleSection(utbtRole?: number): AdminSection | undefined {
  return visibleSections(utbtRole)[0]
}
