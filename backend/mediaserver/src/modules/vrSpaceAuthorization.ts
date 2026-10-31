import { TRPCError } from '@trpc/server';
import { db, schema } from 'database';
import { and, eq } from 'drizzle-orm';
import { hasAtLeastPermissionLevel, hasAtLeastSecurityRole, type UserId, type VrSpaceId } from 'schemas';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Authorize the actual target while keeping its owner and granted permission stable until commit. */
export async function requireVrSpacePermission(
  tx: Transaction,
  userId: UserId,
  vrSpaceId: VrSpaceId,
  required: 'edit' | 'admin',
) {
  const [caller] = await tx.select({ role: schema.users.role })
    .from(schema.users).where(eq(schema.users.userId, userId)).for('share');
  if (!caller || !hasAtLeastSecurityRole(caller.role, 'user')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to modify this space' });
  }

  const [space] = await tx.select({ ownerUserId: schema.vrSpaces.ownerUserId })
    .from(schema.vrSpaces).where(eq(schema.vrSpaces.vrSpaceId, vrSpaceId)).for('update');
  if (!space) throw new TRPCError({ code: 'NOT_FOUND', message: 'VR space not found' });
  if (space.ownerUserId === userId || hasAtLeastSecurityRole(caller.role, 'superadmin')) return;

  const [permission] = await tx.select({ level: schema.permissions.permissionLevel })
    .from(schema.permissions)
    .where(and(
      eq(schema.permissions.userId, userId),
      eq(schema.permissions.targetType, 'vrSpace'),
      eq(schema.permissions.targetId, vrSpaceId),
    )).for('share');
  if (!permission || !hasAtLeastPermissionLevel(permission.level, required)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to modify this space' });
  }
}
