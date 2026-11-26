import { Log } from 'debug-level';
const log = new Log('Router:VR');
process.env.DEBUG = 'Router:VR*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { ClientRealtimeDataSchema, hasAtLeastSecurityRole, PlacedObjectIdSchema, PlacedObjectInsertSchema, ScreenShareSchema, VrSpaceIdSchema, VrSpaceUpdateSchema } from 'schemas';
import { router, isUserClientM, userClientP, atLeastUserP, userInVrSpaceP, userWithEditRightsToVrSpace } from '../trpc/trpc.js';
import { VrSpace } from 'classes/VrSpace.js';
import { z } from 'zod';
import { db, schema } from 'database';
import { eq, and, or, not, sql, isNull, isNotNull, inArray } from 'drizzle-orm';
import { PermissionLevel } from 'database/schema';
import { TRPCError } from '@trpc/server';
import { authorizeResource, withResourceAccess } from '../modules/resourceAccess.js';
import type { VrSpaceId } from 'schemas';

type PermLev = typeof PermissionLevel.enumValues[number] | 'owner' | undefined;

async function refreshLoadedVrSpace(vrSpaceId: VrSpaceId, reason: string, revalidateAccess = false) {
  const space = VrSpace.getVrSpace(vrSpaceId);
  if (!space) return;
  try {
    await space.reloadDbData(reason, revalidateAccess);
  } catch (error) {
    // The mutation is already committed; the space may have been unloaded or deleted meanwhile.
    log.warn('Failed to refresh loaded VR space', error);
    if (revalidateAccess && VrSpace.getVrSpace(vrSpaceId) === space) space.unload();
  }
}

export const vrRouter = router({
  listAvailableVrSpaces: userClientP.query(async ({ ctx }) => {
    log.info('vrSpace listing requested')
    // log.debug('ctx: ', ctx);
    // const user = await db.query.users.findFirst({ where: eq(schema.users.userId, ctx.userId) });
    // log.debug('user: ', user);
    try {

      // Membership checks against the space's organization/unit (correlated subqueries)
      const orgMemberRole = (role?: 'org_admin') => sql`exists (select 1 from "OrganizationMembers" m where m."userId" = ${ctx.userId} and m."organizationId" = ${schema.vrSpaces.organizationId} ${role ? sql`and m."role" = ${role}` : sql``})`;
      const unitMemberRole = (role?: 'unit_admin') => sql`exists (select 1 from "UnitMembers" m where m."userId" = ${ctx.userId} and m."unitId" = ${schema.vrSpaces.unitId} ${role ? sql`and m."role" = ${role}` : sql``})`;
      const orgMember = orgMemberRole();
      const orgAdmin = orgMemberRole('org_admin');
      const unitMember = unitMemberRole();
      const unitAdmin = unitMemberRole('unit_admin');

      let unfilteredQuery = db.select({
      vrSpaceId: schema.vrSpaces.vrSpaceId,
      name: schema.vrSpaces.name,
      image: schema.assets.generatedName,
      visibility: schema.vrSpaces.visibility,
      ownerUserId: schema.vrSpaces.ownerUserId,
      description: schema.vrSpaces.description,
      organizationId: schema.vrSpaces.organizationId,
      // Version of the owning organization's logo (null = no logo); the app builds the image URL from it
      organizationLogoVersion: sql<number | null>`(select l."version" from "OrganizationLogos" l where l."organizationId" = ${schema.vrSpaces.organizationId})`,
      // permisions: schema.permissions,
      permissionLevel: sql<PermLev>`case
          when ${schema.vrSpaces.organizationId} is null and ${schema.vrSpaces.ownerUserId} = ${ctx.userId} then 'owner'
          when ${schema.vrSpaces.organizationId} is not null and (${orgAdmin} or ${unitAdmin}) then 'admin'
          when ${schema.vrSpaces.organizationId} is not null and ${schema.vrSpaces.ownerUserId} = ${ctx.userId} and ${orgMember} then 'owner'
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
          or(isNotNull(schema.vrSpaces.organizationId), not(eq(schema.vrSpaces.ownerUserId, ctx.userId))),
          eq(schema.permissions.targetId, schema.vrSpaces.vrSpaceId)
        )
      ));

      const caller = ctx.role === 'guest' ? undefined : await db.query.users.findFirst({
        columns: { role: true }, where: eq(schema.users.userId, ctx.userId),
      });
      if (ctx.role !== 'guest' && !caller) throw new TRPCError({ code: 'FORBIDDEN', message: 'Account not found' });
      if (ctx.guestVrSpaceId) {
        // A gallery guest only ever sees the one space they were let in to
        return await unfilteredQuery.where(and(
          eq(schema.vrSpaces.vrSpaceId, ctx.guestVrSpaceId),
          or(eq(schema.vrSpaces.visibility, 'public'), eq(schema.vrSpaces.visibility, 'unlisted')),
        ));
      }
      if (caller && hasAtLeastSecurityRole(caller.role, 'superadmin')) {
        return await unfilteredQuery;
      } else {
        const filteredQuery = unfilteredQuery.where(or(
        eq(schema.permissions.userId, ctx.userId),
        and(isNull(schema.vrSpaces.organizationId), eq(schema.vrSpaces.ownerUserId, ctx.userId)),
        // Other people's public spaces are deliberately NOT listed here: they are found through the
        // public guest gallery or a direct link, so users only see their own, their organization's and shared spaces.
        // Organization/unit spaces follow the caller's current memberships
        and(isNotNull(schema.vrSpaces.organizationId), or(
          orgAdmin,
          unitAdmin,
          and(eq(schema.vrSpaces.ownerUserId, ctx.userId), orgMember),
          and(inArray(schema.vrSpaces.visibility, ['public', 'organization']), orgMember), // members also see their organization's public spaces
          and(eq(schema.vrSpaces.visibility, 'unit'), unitMember),
        )),
      ));
        return await filteredQuery;
      }
    } catch (e) {
      log.error(e);
      throw e;
    }
  }),
  createVrSpace: atLeastUserP.use(isUserClientM).input(z.object({ name: z.string() })).mutation(async ({ ctx, input }) => {
    const vrSpaceId = await VrSpace.createNewVrSpace(input.name, ctx.userId);
    return vrSpaceId
  }),
  deleteVrSpace: atLeastUserP.use(isUserClientM).input(z.object({ vrSpaceId: VrSpaceIdSchema })).mutation(async ({ ctx, input }) => {
    const { deleted, portalSpaces } = await db.transaction(async tx => {
      await authorizeResource(tx, ctx, { type: 'vrSpace', id: input.vrSpaceId }, 'admin', { forUpdate: true });
      const portals = await tx.delete(schema.placedObjects).where(and(
        eq(schema.placedObjects.type, 'vrPortal'),
        eq(schema.placedObjects.objectId, input.vrSpaceId),
      )).returning({ vrSpaceId: schema.placedObjects.vrSpaceId });
      await tx.delete(schema.permissions).where(and(
        eq(schema.permissions.targetType, 'vrSpace'),
        eq(schema.permissions.targetId, input.vrSpaceId),
      ));
      const [deleted] = await tx.delete(schema.vrSpaces)
        .where(eq(schema.vrSpaces.vrSpaceId, input.vrSpaceId)).returning();
      return { deleted, portalSpaces: portals.map(portal => portal.vrSpaceId) };
    });
    VrSpace.getVrSpace(input.vrSpaceId)?.unload();
    for (const vrSpaceId of new Set(portalSpaces)) {
      if (vrSpaceId !== input.vrSpaceId) await refreshLoadedVrSpace(vrSpaceId, 'portal target deleted');
    }
    return deleted;
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
    return withResourceAccess(ctx, { type: 'vrSpace', id: input.vrSpaceId }, 'view', async tx => {
      await ctx.client.enterVrSpace(input.vrSpaceId, tx);
      return ctx.client.vrSpace!.getPublicState();
    });
  }),
  leaveVrSpace: userClientP.mutation(({ ctx }) => {
    ctx.client.leaveCurrentVrSpace();
    // ctx.vrSpace.removeClient(ctx.client);
  }),
  updateVrSpace: atLeastUserP.use(isUserClientM).input(VrSpaceUpdateSchema).mutation(async ({ ctx, input }) => {
    log.info('updating vrSpace', input);
    const { vrSpaceId, reason, ...data } = input;
    await db.transaction(async tx => {
      await authorizeResource(tx, ctx, { type: 'vrSpace', id: vrSpaceId }, 'edit', { forUpdate: true });
      await tx.update(schema.vrSpaces).set(data).where(eq(schema.vrSpaces.vrSpaceId, vrSpaceId));
    });
    await refreshLoadedVrSpace(vrSpaceId, reason ?? 'dbData updated. Reloading', data.visibility !== undefined);
  }),
  upsertPlacedObject: atLeastUserP.use(isUserClientM).input(PlacedObjectInsertSchema).mutation(async ({ ctx, input }) => {
    log.info(`upserting placedObject (${input.placedObjectId}): pos: ${input.position}, rot: ${input.orientation}`);
    const { reason, ...data } = input;
    const { updated, sourceId } = await db.transaction(async tx => {
      const [existing] = data.placedObjectId
        ? await tx.select({ vrSpaceId: schema.placedObjects.vrSpaceId }).from(schema.placedObjects)
          .where(eq(schema.placedObjects.placedObjectId, data.placedObjectId)).for('update')
        : [];
      const sourceId = existing?.vrSpaceId;
      const targetIds = [...new Set([input.vrSpaceId, ...(sourceId ? [sourceId] : [])])].sort();
      for (const vrSpaceId of targetIds) await authorizeResource(tx, ctx, { type: 'vrSpace', id: vrSpaceId }, 'edit', { forUpdate: true });
      const [updated] = await tx.insert(schema.placedObjects).values(data).onConflictDoUpdate({
        target: [schema.placedObjects.placedObjectId],
        set: data,
        // If another transaction inserted this ID after our lookup, do not overwrite an object in another space.
        setWhere: eq(schema.placedObjects.vrSpaceId, sourceId ?? input.vrSpaceId),
      }).returning();
      if (!updated) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to modify this object' });
      return { updated, sourceId };
    });
    await refreshLoadedVrSpace(input.vrSpaceId, reason ?? 'placedObject created/updated. Reloading');
    if (sourceId && sourceId !== input.vrSpaceId) await refreshLoadedVrSpace(sourceId, 'placedObject moved');
    return updated;
  }),
  removePlacedObject: atLeastUserP.use(isUserClientM).input(z.object({ placedObjectId: PlacedObjectIdSchema })).mutation(async ({ ctx, input }) => {
    const vrSpaceId = await db.transaction(async tx => {
      const [object] = await tx.select({ vrSpaceId: schema.placedObjects.vrSpaceId }).from(schema.placedObjects)
        .where(eq(schema.placedObjects.placedObjectId, input.placedObjectId)).for('update');
      if (!object) throw new TRPCError({ code: 'NOT_FOUND', message: 'Placed object not found' });
      await authorizeResource(tx, ctx, { type: 'vrSpace', id: object.vrSpaceId }, 'edit', { forUpdate: true });
      await tx.delete(schema.placedObjects).where(eq(schema.placedObjects.placedObjectId, input.placedObjectId));
      return object.vrSpaceId;
    });
    await refreshLoadedVrSpace(vrSpaceId, 'placedObject removed');
  }),
  reloadVrSpaceFromDB: userWithEditRightsToVrSpace.query(async ({ ctx }) => {
    await ctx.vrSpace.reloadDbData();
  }),
  updateRealtimeData: userInVrSpaceP.input(ClientRealtimeDataSchema).mutation(({ input, ctx }) => {
    // log.debug(`transform received from ${ctx.username} (${ctx.connectionId})`);
    ctx.client.clientRealtimeData = input;
    const vrSpace = ctx.vrSpace;
    vrSpace.pendingRealtimeData[ctx.connectionId] = input;
    vrSpace.sendPendingRealtimeData();
  }),
  placeScreenShare: userInVrSpaceP.input(ScreenShareSchema).mutation(({ input, ctx }) => {
    if (ctx.client.publicProducers.value.videoProducer?.producerId !== input.producerId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You are not allowed to share a producer with that ID.' });
    }
    ctx.client.screenShare = input;
    ctx.vrSpace._notifyStateUpdated('client placed screenShare');
    // ctx.vrSpace.addScreenShare(input)
  }),
  removeScreenShare: userInVrSpaceP.mutation(({ ctx }) => {
    // if (ctx.client.publicProducers.value.videoProducer?.producerId !== input.producerId) {
    //   throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You are not allowed to remove a screenshare with that producerID.' });
    // }
    ctx.client.screenShare = undefined;
    ctx.vrSpace._notifyStateUpdated('client removed screenShare');
  // ctx.vrSpace.removeScreenShare(input.producerId)
  })
  // getClientsRealtimeData: userInVrSpaceP.query(({ input, ctx }) => {
  //   return 'NOT IMPLEMENTED' as const;
  // }),
});
