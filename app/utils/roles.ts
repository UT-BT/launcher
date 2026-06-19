export const ROLE_LABELS: Record<number, { label: string; className: string }> = {
    1: { label: 'Moderator', className: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
    2: { label: 'Admin', className: 'bg-purple-500/15 border-purple-500/40 text-purple-300' },
    3: { label: 'Cup Admin', className: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
}

export const ROLE = { USER: 0, MODERATOR: 1, ADMIN: 2, CUP_ADMIN: 3 } as const

// utbt_role is NOT a hierarchy — Cup Admin (3) is a sibling of Admin/Moderator, not
// "above" them — so access is checked by explicit set membership, never role >= n.

// Who may access the staff admin dashboard. Cup Admins are intentionally EXCLUDED.
export const ADMIN_DASHBOARD_ROLES: number[] = [ROLE.MODERATOR, ROLE.ADMIN]
export const ADMIN_ONLY_ROLES: number[] = [ROLE.ADMIN]

type HasRole = { utbt_role?: number } | null | undefined
const roleOf = (p: HasRole) => p?.utbt_role ?? 0

export const isStaff = (p: HasRole) => ADMIN_DASHBOARD_ROLES.includes(roleOf(p))

// Admin > Moderator > everyone: regular users are always actionable; among staff
// only an Admin may act on a Moderator. Used to disable/hide destructive UI actions
// (titles are exempt — any staff may manage anyone's titles).
export const canActOn = (actor: HasRole, target: HasRole): boolean => {
  const a = roleOf(actor)
  const t = roleOf(target)
  if (t === ROLE.USER) return true
  return a === ROLE.ADMIN && t === ROLE.MODERATOR
}
