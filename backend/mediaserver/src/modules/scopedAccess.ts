/**
 * Pure access decision for resources that can belong to an organization or a unit.
 * No database access here on purpose: callers load the caller's memberships and pass
 * them in, which keeps the rules in one place and makes them easy to test.
 *
 * Model:
 *  - A resource with no organizationId is personal: only its owner (and global
 *    superadmins, handled by the caller) and explicit grants can reach it.
 *  - A resource with organizationId (and optionally unitId) belongs to that organization/unit.
 *  - org_admin of the organization administers everything in it, including all its units.
 *  - unit_admin administers resources in their own unit only.
 *  - Plain members only get 'view', and only when visibility allows it:
 *      'organization' -> any member of the organization
 *      'unit'         -> members of the resource's unit
 *    Anything else (including unknown values) fails closed.
 */

export type ScopedVisibility = 'private' | 'unlisted' | 'public' | 'organization' | 'unit';
export type ScopedLevel = 'owner' | 'admin' | 'view';

export type ScopedResource = {
  ownerUserId: string;
  visibility: ScopedVisibility | string;
  organizationId: string | null;
  unitId: string | null;
};

export type CallerMembership = {
  /** Role in the resource's organization, if any. */
  orgRole?: 'org_admin' | 'member' | 'basic' | null;
  /** Role in the resource's unit, if any. */
  unitRole?: 'unit_admin' | 'member' | null;
};

/**
 * Access gained from organization/unit membership, or from ownership of a scoped resource.
 * Returns undefined when membership gives no access (explicit per-resource grants are checked separately).
 */
export function scopedAccessLevel(args: {
  userId: string;
  resource: ScopedResource;
  membership: CallerMembership;
}): ScopedLevel | undefined {
  const { userId, resource, membership } = args;
  const inOrg = !!resource.organizationId && !!membership.orgRole;
  const inUnit = !!resource.unitId && !!membership.unitRole;

  if (!resource.organizationId) {
    // Personal resource: membership is irrelevant. Ownership is handled by the caller.
    return undefined;
  }

  if (membership.orgRole === 'org_admin') return 'admin';
  if (inUnit && membership.unitRole === 'unit_admin') return 'admin';

  // An owner who has since left the organization/unit loses ownership rights over its resources.
  const stillBelongs = resource.unitId ? inUnit || inOrg : inOrg;
  if (resource.ownerUserId === userId && stillBelongs) return 'owner';

  switch (resource.visibility) {
    case 'organization':
      return inOrg ? 'view' : undefined;
    case 'unit':
      return inUnit ? 'view' : undefined;
    default:
      return undefined;
  }
}
