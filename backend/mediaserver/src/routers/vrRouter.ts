import { Log } from 'debug-level';
const log = new Log('Router:VR');
process.env.DEBUG = 'Router:VR*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { ClientTransformSchema, VrSpaceIdSchema } from 'schemas';
import { procedure as p, router, isUserClientM, userClientP, atLeastUserP, userInVrSpaceP } from '../trpc/trpc.js';
import { VrSpace } from 'classes/VrSpace.js';
import { z } from 'zod';
import { db, schema } from 'database';
import { eq, and, or } from 'drizzle-orm';
import { permissions } from 'database/schema';

export const vrRouter = router({
  listAvailableVrSpaces: userClientP.query(async ({ ctx }) => {
    // const dbResponse = await db.query.vrSpaces.findMany({
    //   with: {
    //     panoramicPreview: true,
    //     allowedUsers: true,
    //   },
    //   where: eq(schema.vrSpaces.visibility, 'public'),
    // })
    // return dbResponse;
    const dbResponse = await db.select({
      vrSpaceId: schema.vrSpaces.vrSpaceId,
      name: schema.vrSpaces.name,
      visibility: schema.vrSpaces.visibility,
      ownerUserId: schema.vrSpaces.ownerUserId,
      permissions: schema.permissions
    }).from(schema.vrSpaces)
      .leftJoin(schema.permissions, and(
        eq(schema.permissions.targetType, 'vrSpace'),
        eq(schema.permissions.targetId, schema.vrSpaces.vrSpaceId)
      )).where(or(
        eq(schema.vrSpaces.visibility, 'public'),
        eq(schema.permissions.userId, ctx.userId)
      ))

    log.info(dbResponse)
    return dbResponse;
  }),
  createVrSpace: atLeastUserP.use(isUserClientM).input(z.object({ name: z.string() })).mutation(async ({ ctx, input }) => {
    const vrSpaceId = await VrSpace.createNewVrSpace(input.name, ctx.userId);
    return vrSpaceId
  }),
  // openVrSpace: currentVenueAdminP.use(isVenueOwnerM).use(currentVenueHasVrSpaceM).mutation(({ctx}) => {
  //   ctx.vrSpace.open();
  // }),
  // closeVrSpace: currentVenueAdminP.use(isVenueOwnerM).use(currentVenueHasVrSpaceM).mutation(({ctx}) => {
  //   ctx.vrSpace.close();
  // }),
  enterVrSpace: userClientP.input(z.object({ vrSpaceId: VrSpaceIdSchema })).mutation(async ({ input, ctx }) => {
    // if(!ctx.venue.doorsAreOpen){
    //   throw new TRPCError({code: 'FORBIDDEN', message: 'The vr space is not opened to users at this point. Very sad!'});
    // }
    await ctx.client.enterVrSpace(input.vrSpaceId);
    return ctx.client.vrSpace?.getPublicState();
  }),
  leaveVrSpace: userClientP.mutation(({ ctx }) => {
    ctx.client.leaveCurrentVrSpace();
    // ctx.vrSpace.removeClient(ctx.client);
  }),
  // getState: userInVrSpaceP.query(({ ctx }) => {
  //   ctx.vrSpace.getPublicState();
  // }),
  // create3DModel: currentVenueAdminP.use(isVenueOwnerM).use(currentVenueHasVrSpaceM).input(VirtualSpace3DModelCreateSchema).mutation(({input, ctx}) => {
  //   ctx.venue.Create3DModel(input.modelUrl);
  // }),
  // remove3DModel: currentVenueAdminP.use(isVenueOwnerM).use(currentVenueHasVrSpaceM).input(VirtualSpace3DModelRemoveSchema).mutation(({input, ctx}) => {
  //   ctx.venue.Remove3DModel(input.modelId);
  // }),
  // updateNavmesh: currentVenueAdminP.use(isVenueOwnerM).use(currentVrSpaceHasModelM).input(VirtualSpace3DModelCreateSchema).mutation(({input, ctx}) => {
  //   ctx.venue.UpdateNavmesh(input.modelUrl);
  // }),
  // TODO: Implement this (update 3D model)
  // update3DModel: currentVenueAdminP.use(isVenueOwnerM).use(currentVenueHasVrSpaceM).input(VirtualSpace3DModelUpdateSchema).mutation(({input, ctx}) => {
  //   // ctx.vrSpace.Update3DModel(input);
  // }),
  // setSkyColor: currentVenueAdminP.use(isVenueOwnerM).use(currentVenueHasVrSpaceM).input({})
  transform: router({
    updateTransform: userInVrSpaceP.input(ClientTransformSchema).mutation(({ input, ctx }) => {
      log.debug(`transform received from ${ctx.username} (${ctx.connectionId})`);
      log.debug(input);
      ctx.client.transform = input;
      const vrSpace = ctx.vrSpace;
      vrSpace.pendingTransforms[ctx.connectionId] = input;
      vrSpace.sendPendingTransforms();
    }),
    getClientTransforms: userInVrSpaceP.query(({ input, ctx }) => {
      return 'NOT IMPLEMENTED' as const;
    }),
  })
});
