import { TRPCError } from '@trpc/server';
import { db, schema } from 'database';
import { and, eq } from 'drizzle-orm';
import { scopedAccessLevel, type CallerMembership } from './scopedAccess.js';
import { hasAtLeastPermissionLevel, hasAtLeastSecurityRole, type JwtUserData, type OrganizationId, type StreamId, type UnitId, type UserId, type VrSpaceId } from 'schemas';

type Identity = Pick<JwtUserData, 'userId' | 'role' | 'guestVrSpaceId'>;
export type Resource = { type: 'stream'; id: StreamId } | { type: 'vrSpace'; id: VrSpaceId };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The caller's current role in a resource's organization and (if any) unit. */
async function loadMembership(tx: Transaction, userId: UserId, organizationId: string, unitId: string | null): Promise<CallerMembership> {
  const [org] = await tx.select({ role: schema.organizationMembers.role }).from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, userId), eq(schema.organizationMembers.organizationId, organizationId as OrganizationId))).for('share');
  const [unit] = unitId ? await tx.select({ role: schema.unitMembers.role }).from(schema.unitMembers)
    .where(and(eq(schema.unitMembers.userId, userId), eq(schema.unitMembers.unitId, unitId as UnitId))).for('share') : [];
  return { orgRole: org?.role ?? null, unitRole: unit?.role ?? null };
}

/** Lock and authorize the actual resource against the caller's current database role and grant. */
export async function authorizeResource(
  tx: Transaction,
  identity: Identity,
  resource: Resource,
  required: 'view' | 'edit' | 'admin',
  options: { forUpdate?: boolean; requireModerator?: boolean } = {},
) {
  // A guest who came in through the public gallery may only enter the one space they chose.
  if (identity.guestVrSpaceId && !(resource.type === 'vrSpace' && resource.id === identity.guestVrSpaceId)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This guest link only gives access to one environment' });
  }
  const [caller] = identity.role === 'guest' ? [] : await tx.select({ role: schema.users.role }).from(schema.users)
    .where(eq(schema.users.userId, identity.userId)).for('share');
  if (identity.role !== 'guest' && !caller) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to access this resource' });
  const role = caller?.role ?? 'guest';
  if ((required !== 'view' && !hasAtLeastSecurityRole(role, 'user'))
    || (options.requireModerator && !hasAtLeastSecurityRole(role, 'moderator'))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to access this resource' });
  }
  const lock = options.forUpdate ? 'update' : 'share';
  const [target] = resource.type === 'stream'
    ? await tx.select({ ownerUserId: schema.streams.ownerUserId, visibility: schema.streams.visibility, organizationId: schema.streams.organizationId, unitId: schema.streams.unitId })
      .from(schema.streams).where(eq(schema.streams.streamId, resource.id)).for(lock)
    : await tx.select({ ownerUserId: schema.vrSpaces.ownerUserId, visibility: schema.vrSpaces.visibility, organizationId: schema.vrSpaces.organizationId, unitId: schema.vrSpaces.unitId })
      .from(schema.vrSpaces).where(eq(schema.vrSpaces.vrSpaceId, resource.id)).for(lock);
  if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
  if (required === 'view' && (target.visibility === 'public' || target.visibility === 'unlisted')) return 'view' as const;
  // Global superadmins, and owners of personal (non-organization) resources, have full control.
  if (role !== 'guest' && (hasAtLeastSecurityRole(role, 'superadmin') || (!target.organizationId && target.ownerUserId === identity.userId))) return 'owner' as const;

  // Resources that belong to an organization/unit: access follows the caller's current memberships.
  if (role !== 'guest' && target.organizationId) {
    const membership = await loadMembership(tx, identity.userId, target.organizationId, target.unitId);
    const level = scopedAccessLevel({ userId: identity.userId, resource: target, membership });
    if (level && hasAtLeastPermissionLevel(level, required)) return level;
  }

  if (role !== 'guest') {
    const [permission] = await tx.select({ level: schema.permissions.permissionLevel }).from(schema.permissions)
      .where(and(
        eq(schema.permissions.userId, identity.userId),
        eq(schema.permissions.targetType, resource.type),
        eq(schema.permissions.targetId, resource.id),
      )).for('share');
    if (permission && hasAtLeastPermissionLevel(permission.level, required)) return permission.level;
  }
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to access this resource' });
}

/** Keep authorization locks until the operation finishes. */
export async function withResourceAccess<T>(identity: Identity, resource: Resource, required: 'view' | 'admin', action: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await authorizeResource(tx, identity, resource, required, { requireModerator: required === 'admin' });
    return action(tx);
  });
}
