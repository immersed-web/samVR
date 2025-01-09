import { Log } from 'debug-level';
const log = new Log('Router:User');
process.env.DEBUG = 'Router:User*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { db, getPermissionLevelForTarget, groupUserPermissions, queryUserWithIncludes, schema } from 'database';
import { procedure as p, router, atLeastUserP, isUserClientM } from '../trpc/trpc.js';
import { z } from 'zod';
import { AvatarDesignSchema, LocalClientInitDataSchema, PermissionDeleteSchema, PermissionInsertSchema, UuidSchema, hasAtLeastPermissionLevel, hasAtLeastSecurityRole, isStreamPermission, isVrSpacePermission } from 'schemas';
import { Stream, VrSpace } from 'classes/InternalClasses.js';
import { and, eq } from 'drizzle-orm';

export const userRouter = router({
  // getClientState: p.query(({ctx}) => {
  //   if (ctx.client.clientType === 'client') {
  //     return ctx.client.getPrivateState();
  //   }
  //   return ctx.client.getPublicState();
  // }),
  reloadUserDataFromDB: atLeastUserP.use(isUserClientM).mutation(async ({ ctx }) => {
    await ctx.client.loadDbDataAndNotifySelf();
  }),
  updateAvatarDesign: p.use(isUserClientM).input(AvatarDesignSchema).mutation(async ({ ctx, input }) => {
    log.info('updateAvatarDesign triggered');
    ctx.client.avatarDesign = input;
    if (hasAtLeastSecurityRole(ctx.client.role, 'user')) {
      const updateResponse = await db.update(schema.users).set({
        avatarDesign: input,
      }).where(eq(schema.users.userId, ctx.userId)).returning();
      ctx.client.loadDbDataAndNotifySelf('avatar design updated');
    }
  }),
  initLocalClientData: p.use(isUserClientM).input(LocalClientInitDataSchema).mutation(async ({ ctx, input }) => {
    log.debug('initLocalClientData triggered');
    // log.debug('initLocalClientData', input);
    ctx.client.avatarDesign = input.avatarDesign;
  }),
  getAllUsers: atLeastUserP.use(isUserClientM).query(async ({ ctx }) => {
    const dbResponse = await db.query.users.findMany({
      with: {
        permissions: true
      }
    })
    return dbResponse;
  }),
  createPermission: atLeastUserP.use(isUserClientM).input(PermissionInsertSchema).mutation(async ({ ctx, input }) => {
    if (ctx.userId === input.userId) {
      throw Error('cant create permission for yourself!');
    }
    const providedUserPermissionLevel = await getPermissionLevelForTarget(input.targetType, input.targetId, input.userId);
    if (providedUserPermissionLevel && hasAtLeastPermissionLevel(providedUserPermissionLevel, 'view')) {
      throw new Error('permission to that target already exists for that user');
    }
    const userPermissionLevel = await getPermissionLevelForTarget(input.targetType, input.targetId, ctx.userId);

    log.info('permission for requesting user', userPermissionLevel);
    if (!userPermissionLevel || !hasAtLeastPermissionLevel(userPermissionLevel, 'edit')) {
      throw Error('you are not authorized to do that');
    }
    if (input.permissionLevel && !hasAtLeastPermissionLevel(userPermissionLevel, input.permissionLevel)) {
      throw Error('cant create permission with higher level than yourself!');
    }
    // const user = await queryUserWithIncludes.execute({ userId: ctx.userId });
    // if (!user) throw new Error('no user found with that id');
    // const perms = groupUserPermissions(user.permissions);

    // let permissionExists = false;
    // if (input.targetType === 'stream') {
    //   if (user.ownedStreams.some(s => s.streamId === input.targetId)) {
    //     permissionExists = true;
    //   } else {
    //     permissionExists = perms.streams.some(p => p.streamId === input.targetId)
    //   }
    // } else if (input.targetType === 'vrSpace') {
    //   if (user.ownedVrSpaces.some(s => s.vrSpaceId === input.targetId)) {
    //     permissionExists = true;
    //   } else {
    //     permissionExists = perms.vrSpaces.some(p => p.vrSpaceId === input.targetId)
    //   }
    // }
    log.info('gonna try to create permission', input);

    const [dbResponse] = await db.insert(schema.permissions).values(input).returning();
    if (isStreamPermission(dbResponse)) {
      const stream = Stream.getStream(dbResponse.targetId);
      if (stream) stream.reloadDbData('permission was created');
    } else if (isVrSpacePermission(dbResponse)) {
      const vrSpace = VrSpace.getVrSpace(dbResponse.targetId);
      if (vrSpace) vrSpace.reloadDbData('permission was created');
    }
    return dbResponse
  }),
  removePermission: atLeastUserP.use(isUserClientM).input(PermissionDeleteSchema).mutation(async ({ ctx, input }) => {

    //TODO: Check permission to delete permission :-P
    const [dbResponse] = await db.delete(schema.permissions).where(
      and(
        eq(schema.permissions.userId, input.userId),
        eq(schema.permissions.targetType, input.targetType),
        eq(schema.permissions.targetId, input.targetId)
      )
    ).returning();
    if (isStreamPermission(dbResponse)) {
      const stream = Stream.getStream(dbResponse.targetId);
      if (stream) stream.reloadDbData('permission was deleted');
    } else if (isVrSpacePermission(dbResponse)) {
      const vrSpace = VrSpace.getVrSpace(dbResponse.targetId);
      if (vrSpace) vrSpace.reloadDbData('permission was deleted');
    }
    return dbResponse;
  })
});
