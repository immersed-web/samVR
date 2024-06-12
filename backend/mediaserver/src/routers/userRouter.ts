import { db, schema } from 'database';
import { procedure as p, router, atLeastUserP, isUserClientM } from '../trpc/trpc.js';
import { z } from 'zod';
import { PermissionInsertSchema, UuidSchema, isStreamPermission, isVrSpacePermission } from 'schemas';
import { Stream, VrSpace } from 'classes/InternalClasses.js';

export const userRouter = router({
  getClientState: p.query(({ctx}) => {
    return ctx.client.getPublicState();
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
