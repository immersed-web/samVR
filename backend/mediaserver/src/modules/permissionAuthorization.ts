import { TRPCError } from '@trpc/server';
import { db, schema } from 'database';
import { and, eq } from 'drizzle-orm';
import { hasAtLeastPermissionLevel, hasAtLeastSecurityRole, type StreamId, type UserId, type VrSpaceId } from 'schemas';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PermissionTarget =
  | { type: 'stream'; id: StreamId }
  | { type: 'vrSpace'; id: VrSpaceId };

/** Lock the caller and target, then determine the caller's current permission to manage grants. */
export async function requirePermissionManagement(tx: Transaction, userId: UserId, target: PermissionTarget) {
  const [caller] = await tx.select({ role: schema.users.role })
    .from(schema.users).where(eq(schema.users.userId, userId)).for('share');
  if (!caller || !hasAtLeastSecurityRole(caller.role, 'user')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to manage permissions' });
  }

  const [resource] = target.type === 'stream'
    ? await tx.select({ ownerUserId: schema.streams.ownerUserId }).from(schema.streams)
      .where(eq(schema.streams.streamId, target.id)).for('update')
    : await tx.select({ ownerUserId: schema.vrSpaces.ownerUserId }).from(schema.vrSpaces)
      .where(eq(schema.vrSpaces.vrSpaceId, target.id)).for('update');
  if (!resource) throw new TRPCError({ code: 'NOT_FOUND', message: 'Permission target not found' });
  if (resource.ownerUserId === userId || hasAtLeastSecurityRole(caller.role, 'superadmin')) return 'owner' as const;

  const [permission] = await tx.select({ level: schema.permissions.permissionLevel }).from(schema.permissions)
    .where(and(
      eq(schema.permissions.userId, userId),
      eq(schema.permissions.targetType, target.type),
      eq(schema.permissions.targetId, target.id),
    )).for('share');
  if (!permission || !hasAtLeastPermissionLevel(permission.level, 'edit')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to manage permissions' });
  }
  return permission.level;
}
