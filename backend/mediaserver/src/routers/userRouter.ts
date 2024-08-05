import { Log } from 'debug-level';
const log = new Log('Router:User');
process.env.DEBUG = 'Router:User*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { db, getPermissionLevelForTarget, groupUserPermissions, queryUserWithIncludes, schema } from 'database';
import { procedure as p, router, atLeastUserP, isUserClientM } from '../trpc/trpc.js';
import { z } from 'zod';
import { PermissionInsertSchema, UuidSchema, hasAtLeastPermissionLevel, isStreamPermission, isVrSpacePermission } from 'schemas';
import { Stream, VrSpace } from 'classes/InternalClasses.js';

export const userRouter = router({
  // getClientState: p.query(({ctx}) => {
  //   if (ctx.client.clientType === 'client') {
  //     return ctx.client.getPrivateState();
  //   }
  //   return ctx.client.getPublicState();
  // }),
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
    if (providedUserPermissionLevel !== 'unauthorized' && hasAtLeastPermissionLevel(providedUserPermissionLevel, 'view')) {
      throw new Error('permission to that target already exists for that user');
    }
    const userPermissionLevel = await getPermissionLevelForTarget(input.targetType, input.targetId, ctx.userId);

    log.info('permission for requesting user', userPermissionLevel);
    if (userPermissionLevel === 'unauthorized' || !hasAtLeastPermissionLevel(userPermissionLevel, 'edit')) {
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
  })
});
