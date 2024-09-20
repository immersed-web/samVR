import { Log } from 'debug-level';
const log = new Log('Router:VR');
process.env.DEBUG = 'Router:VR*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { ClientRealtimeDataSchema, PlacedObjectIdSchema, PlacedObjectInsertSchema, VrSpaceIdSchema, VrSpaceUpdateSchema } from 'schemas';
import { procedure as p, router, isUserClientM, userClientP, atLeastUserP, userInVrSpaceP, userWithEditRightsToVrSpace } from '../trpc/trpc.js';
import { VrSpace } from 'classes/VrSpace.js';
import { z } from 'zod';
import { db, schema, } from 'database';
import { eq, and, or, not, sql } from 'drizzle-orm';
import { PermissionLevel } from 'database/schema';

type PermLev = typeof PermissionLevel.enumValues[number] | 'owner' | undefined;

export const vrRouter = router({
  listAvailableVrSpaces: userClientP.query(async ({ ctx }) => {
    log.info('vrSpace listing requested')
    // log.debug('ctx: ', ctx);
    // const user = await db.query.users.findFirst({ where: eq(schema.users.userId, ctx.userId) });
    // log.debug('user: ', user);
    try {

    const dbResponse = await db.select({
      vrSpaceId: schema.vrSpaces.vrSpaceId,
      name: schema.vrSpaces.name,
      image: schema.assets.generatedName,
      visibility: schema.vrSpaces.visibility,
      ownerUserId: schema.vrSpaces.ownerUserId,
      // permisions: schema.permissions,
      permissionLevel: sql<PermLev>`case
          when ${schema.vrSpaces.ownerUserId} = ${ctx.userId} then 'owner'
          else ${schema.permissions.permissionLevel}::TEXT
          end`.as('permissionLevel'),
      // when ${schema.permissions.permissionLevel} is NULL then 'unauthorized'
    }).from(schema.vrSpaces)
      .leftJoin(schema.assets, eq(schema.vrSpaces.panoramicPreviewAssetId, schema.assets.assetId))
      .leftJoin(schema.permissions, and(
        eq(schema.permissions.targetType, 'vrSpace'),
        and(
          // we dont want duplicates. So join only if not already owner
          eq(schema.permissions.userId, ctx.userId),
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
  updateVrSpace: userWithEditRightsToVrSpace.input(VrSpaceUpdateSchema).mutation(async ({ ctx, input }) => {
    log.info('updating vrSpace', input);
    const { vrSpaceId, reason, ...data } = input;
    const [dbResponse] = await db.update(schema.vrSpaces).set(data).where(eq(schema.vrSpaces.vrSpaceId, vrSpaceId)).returning();
    console.log('db insert response: ', dbResponse);
    const vrSpace = VrSpace.getVrSpace(vrSpaceId);
    if (!vrSpace) return;
    vrSpace.reloadDbData(reason ?? 'dbData updated. Reloading');
  }),
  upsertPlacedObject: userWithEditRightsToVrSpace.input(PlacedObjectInsertSchema).mutation(async ({ ctx, input }) => {
    const { reason, ...data } = input;
    const [dbResponse] = await db.insert(schema.placedObjects).values(data).onConflictDoUpdate({
      target: [schema.placedObjects.placedObjectId],
      set: data,
    }).returning();
    const vrSpace = VrSpace.getVrSpace(input.vrSpaceId);
    if (!vrSpace) return;
    vrSpace.reloadDbData(reason ?? 'placedObject created/updated. Reloading');
    return dbResponse;
  }),
  removePlacedObject: userWithEditRightsToVrSpace.input(z.object({ placedObjectId: PlacedObjectIdSchema })).mutation(async ({ ctx, input }) => {
    const [dbResponse] = await db.delete(schema.placedObjects).where(eq(schema.placedObjects.placedObjectId, input.placedObjectId)).returning();
  }),
  reloadVrSpaceFromDB: userWithEditRightsToVrSpace.query(async ({ ctx }) => {
    await ctx.vrSpace.reloadDbData();
  }),
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
    updateTransform: userInVrSpaceP.input(ClientRealtimeDataSchema).mutation(({ input, ctx }) => {
      // log.debug(`transform received from ${ctx.username} (${ctx.connectionId})`);
      ctx.client.clientRealtimeData = input;
      const vrSpace = ctx.vrSpace;
      vrSpace.pendingTransforms[ctx.connectionId] = input;
      vrSpace.sendPendingTransforms();
    }),
    getClientTransforms: userInVrSpaceP.query(({ input, ctx }) => {
      return 'NOT IMPLEMENTED' as const;
    }),
  })
});
