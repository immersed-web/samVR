import { TRPCError } from '@trpc/server';
import { db, schema } from 'database';
import { and, eq } from 'drizzle-orm';
import { hasAtLeastPermissionLevel, hasAtLeastSecurityRole, type JwtUserData, type StreamId, type VrSpaceId } from 'schemas';

type Identity = Pick<JwtUserData, 'userId' | 'role'>;
export type Resource = { type: 'stream'; id: StreamId } | { type: 'vrSpace'; id: VrSpaceId };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Lock and authorize the actual resource against the caller's current database role and grant. */
export async function authorizeResource(
  tx: Transaction,
  identity: Identity,
  resource: Resource,
  required: 'view' | 'edit' | 'admin',
  options: { forUpdate?: boolean; requireModerator?: boolean } = {},
) {
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
    ? await tx.select({ ownerUserId: schema.streams.ownerUserId, visibility: schema.streams.visibility })
      .from(schema.streams).where(eq(schema.streams.streamId, resource.id)).for(lock)
    : await tx.select({ ownerUserId: schema.vrSpaces.ownerUserId, visibility: schema.vrSpaces.visibility })
      .from(schema.vrSpaces).where(eq(schema.vrSpaces.vrSpaceId, resource.id)).for(lock);
  if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
  if (required === 'view' && (target.visibility === 'public' || target.visibility === 'unlisted')) return 'view' as const;
  if (role !== 'guest' && (target.ownerUserId === identity.userId || hasAtLeastSecurityRole(role, 'superadmin'))) return 'owner' as const;

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
