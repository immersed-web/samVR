import { Log } from 'debug-level';
const log = new Log('Router:VR');
process.env.DEBUG = 'Router:VR*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { ClientTransformSchema, PlacedObjectInsertSchema, VrSpaceIdSchema, vrSpaceUpdateSchema } from 'schemas';
import { procedure as p, router, isUserClientM, userClientP, atLeastUserP, userInVrSpaceP } from '../trpc/trpc.js';
import { VrSpace } from 'classes/VrSpace.js';
import { z } from 'zod';
import { basicUserSelect, db, schema } from 'database';
import { eq, and, or, not, sql } from 'drizzle-orm';
import { PermissionLevel } from 'database/schema';
import { update } from 'lodash-es';

type PermLev = typeof PermissionLevel.enumValues[number] | 'owner' | undefined;

export const vrRouter = router({
  listAvailableVrSpaces: userClientP.query(async ({ ctx }) => {
    log.info('vrSpace listing requested')
    try {

    const dbResponse = await db.select({
      vrSpaceId: schema.vrSpaces.vrSpaceId,
      name: schema.vrSpaces.name,
      visibility: schema.vrSpaces.visibility,
      ownerUserId: schema.vrSpaces.ownerUserId,
      // permisions: schema.permissions.permissionLevel
      permissionLevel: sql<PermLev>`case 
          when ${schema.vrSpaces.ownerUserId} = ${ctx.userId} then 'owner'
          else ${schema.permissions.permissionLevel}::TEXT
          end`.as('permissionLevelsss'),
      // when ${schema.permissions.permissionLevel} is NULL then 'unauthorized'
    }).from(schema.vrSpaces)
      .leftJoin(schema.permissions, and(
        eq(schema.permissions.targetType, 'vrSpace'),
        and(
          // we dont want duplicates. So join only if not already owner
          not(eq(schema.vrSpaces.ownerUserId, ctx.userId)),
          eq(schema.permissions.targetId, schema.vrSpaces.vrSpaceId)
        )
      )).where(or(
        eq(schema.permissions.userId, ctx.userId),
        eq(schema.vrSpaces.ownerUserId, ctx.userId),
        eq(schema.vrSpaces.visibility, 'public'),
      ));

    log.info(dbResponse)
    return dbResponse;
    } catch (e) {
      log.error(e);
    }
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
    const vrSpace = ctx.client.vrSpace!;
    // log.info('entering vrSpace', vrSpace);
    return vrSpace.getPublicState();
  }),
  leaveVrSpace: userClientP.mutation(({ ctx }) => {
    ctx.client.leaveCurrentVrSpace();
    // ctx.vrSpace.removeClient(ctx.client);
  }),
  // TODO: only allow users with permission
  updateVrSpace: atLeastUserP.use(isUserClientM).input(vrSpaceUpdateSchema).mutation(async ({ ctx, input }) => {
    // log.info('updating vrSpace', input);
    const { vrSpaceId, reason, ...data } = input;
    const [dbResponse] = await db.update(schema.vrSpaces).set(data).where(eq(schema.vrSpaces.vrSpaceId, vrSpaceId)).returning();
    const vrSpace = VrSpace.getVrSpace(vrSpaceId);
    if (!vrSpace) return;
    vrSpace.reloadDbData(reason ?? 'dbData updated. Reloading');
  }),
  createPlacedObject: atLeastUserP.use(isUserClientM).input(PlacedObjectInsertSchema).mutation(async ({ ctx, input }) => {
    const { placedObjectId, reason, ...data } = input;
    const [dbResponse] = await db.insert(schema.placedObjects).values(data).returning();
    const vrSpace = VrSpace.getVrSpace(input.vrSpaceId);
    if (!vrSpace) return;
    vrSpace.reloadDbData(reason ?? 'placedObject created. Reloading');
    return dbResponse;
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
