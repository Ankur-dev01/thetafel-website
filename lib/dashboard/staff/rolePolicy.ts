import type { StaffRole } from '@/lib/dashboard/nav'

/**
 * Who may do what to WHOM in staff management (PRD §2.2). Pure — used by the
 * staff API routes (authoritative) and the Team page (to show only the
 * controls that will work).
 *
 *   - Nobody invites, promotes to, or deactivates an `owner` (exactly one owner,
 *     bound to restaurants.user_id; transfer is a support operation).
 *   - Owners manage manager / service / kitchen.
 *   - Managers manage service / kitchen only — never owners or other managers.
 *   - Nobody changes or deactivates their own membership here.
 */

export type InvitableRole = Exclude<StaffRole, 'owner'>
export const INVITABLE_ROLES: readonly InvitableRole[] = ['manager', 'service', 'kitchen']

export function invitableRolesFor(actor: StaffRole): readonly InvitableRole[] {
  if (actor === 'owner') return ['manager', 'service', 'kitchen']
  if (actor === 'manager') return ['service', 'kitchen']
  return []
}

export function canInviteRole(actor: StaffRole, target: StaffRole): boolean {
  return (invitableRolesFor(actor) as readonly StaffRole[]).includes(target)
}

type Target = { role: StaffRole; isSelf: boolean }

/** Roles the actor may assign, given the member being changed. Empty = not allowed. */
export function assignableRolesFor(actor: StaffRole, target: Target): readonly InvitableRole[] {
  if (target.isSelf || target.role === 'owner') return []
  if (actor === 'owner') return ['manager', 'service', 'kitchen']
  if (actor === 'manager' && (target.role === 'service' || target.role === 'kitchen')) {
    return ['service', 'kitchen']
  }
  return []
}

export function canChangeRole(actor: StaffRole, target: Target, newRole: StaffRole): boolean {
  return (assignableRolesFor(actor, target) as readonly StaffRole[]).includes(newRole)
}

/** Deactivate and reactivate share one rule. */
export function canToggleActive(actor: StaffRole, target: Target): boolean {
  if (target.isSelf || target.role === 'owner') return false
  if (actor === 'owner') return true
  return actor === 'manager' && (target.role === 'service' || target.role === 'kitchen')
}

/** Pending invites: revoking follows the invite's role like inviting does. */
export function canRevokeInvite(actor: StaffRole, inviteRole: StaffRole): boolean {
  return canInviteRole(actor, inviteRole)
}
