import { db, schema } from 'database';
import { procedure as p, router, atLeastUserP, isUserClientM } from '../trpc/trpc.js';
import { z } from 'zod';
import { PermissionInsertSchema, UuidSchema } from 'schemas';

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
    return dbResponse
  })
});
