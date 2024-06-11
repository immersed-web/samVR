import { Log } from 'debug-level';
const log = new Log('Router:Admin');
process.env.DEBUG = 'Router:Admin*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { BaseClient, Camera, loadUserDBData, SenderClient, UserClient, Venue } from '../classes/InternalClasses.js';
import { CameraIdSchema, hasAtLeastSecurityLevel, SenderIdSchema, StreamId, StreamIdSchema, StreamUpdateSchema, CameraInsertSchema, CameraPortalInsertSchema, CameraUpdateSchema } from 'schemas';
import { z } from 'zod';
import { atLeastModeratorP, currentVenueAdminP, isUserClientM, isVenueOwnerM, procedure as p, router } from '../trpc/trpc.js';
import { db, schema } from 'database';
import { and, eq } from 'drizzle-orm';
import * as _ from 'lodash-es';

export const adminRouter = router({
  createNewStream: atLeastModeratorP.use(isUserClientM).input(z.object({
    name: z.string()
  })).mutation(async ({input, ctx}) => {
    const streamId = await Venue.createNewStream(input.name, ctx.userId);
    ctx.client.loadPrismaDataAndNotifySelf('Stream created');
    return streamId;
  }),
  updateStream: currentVenueAdminP.input(StreamUpdateSchema).mutation(async ({ input, ctx }) => {
    await ctx.stream.update(input);
    ctx.client.loadPrismaDataAndNotifySelf('updated stream info/settings');
    ctx.stream._notifyStateUpdated('stream settings/data updated');
  }),
  deleteStream: atLeastModeratorP.use(isUserClientM).input(z.object({ streamId: StreamIdSchema })).mutation(async ({ ctx, input }) => {
    const streamId = input.streamId;
    if (Venue.streamIsLoaded({ streamId: streamId })) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Cant delete a stream when its loaded. Unload it first!' });
    }
    if(
      !hasAtLeastSecurityLevel(ctx.role, 'admin')
      && -1 === ctx.client.ownedVenues.value.findIndex(v => v.streamId === streamId)) {
      throw new TRPCError({code: 'PRECONDITION_FAILED', message: 'You are not owner or dont have high enough permission. Now Cry!'});
    }

    const [deletedVenue] = await Venue.deleteStream(streamId);
    await ctx.client.loadPrismaDataAndNotifySelf('stream deleted');
    return deletedVenue.streamId;
  }),
  loadStream: atLeastModeratorP.input(z.object({ streamId: StreamIdSchema })).mutation(async ({ input, ctx }) => {
    const stream = await Venue.loadStream(input.streamId, ctx.userId);
    return { publicVenueState: stream.getPublicState(), adminOnlyVenueState: stream.getAdminOnlyState() };
  }),
  loadAndJoinStream: atLeastModeratorP.input(z.object({ streamId: StreamIdSchema })).mutation(async ({ input, ctx }) => {
    const stream = await Venue.loadStream(input.streamId, ctx.userId);
    const vState = await ctx.client.joinStream(input.streamId);
    const adminOnlyState = stream.getAdminOnlyState();
    return { publicStreamState: vState, adminOnlyStramState: adminOnlyState };
  }),
  listMyStreams: atLeastModeratorP.query(async ({ ctx }) => {
    return ctx.client.ownedVenues.value.map(({ streamId, name }) => ({ streamId, name }));
  }),
  createCamera: currentVenueAdminP.input(z.object({
    name: z.string(),
    senderId: SenderIdSchema.optional(),
  })).mutation(async ({ctx, input}) => {
    try{
      const { name, senderId } = input;
      log.info(`received request to create camera with name ${name} and senderId ${senderId}`);
      const cId = await ctx.stream.createAndLoadNewCamera(name, senderId);
      // ctx.venue.loadCamera(cId);
    } catch(e) {
      log.error('FAILED TO CREATE CAMERA!!!');
      log.error(e);
      throw new TRPCError({code: 'INTERNAL_SERVER_ERROR', message: 'Kunde inte skapa kamera! okänt fel 😥'});
    }
  }),
  deleteCamera: currentVenueAdminP.input(z.object({
    cameraId: CameraIdSchema,
  })).mutation(async ({ ctx, input})=> {
    return await ctx.stream.deleteCamera(input.cameraId);
  }),
  setSenderForCamera: currentVenueAdminP.input(z.object({
    senderId: SenderIdSchema,
    cameraId: CameraIdSchema,
  })).mutation(async ({ctx, input}) => {
    return ctx.stream.setSenderForCamera(input.senderId, input.cameraId);
  }),
  updateCamera: currentVenueAdminP.input(CameraUpdateSchema).mutation(async ({ ctx, input }) => {
    const { cameraId, reason, ...data } = input;
    const [dbResponse] = await db.update(schema.cameras).set(data).where(eq(schema.cameras.cameraId, cameraId)).returning();
    
    const camera = ctx.stream.cameras.get(cameraId);
    if(!camera) return;
    camera.reloadDbData('camera db data was updated');
    // camera.prismaData = dbResponse;
    const reasonForPrint = reason ?? 'unknown';
    camera._notifyStateUpdated(`camera was updated: ${reasonForPrint}`);
    ctx.stream._notifyAdminOnlyState(`camera was updated: ${reasonForPrint}`);
    
  }),
  setCameraPortal: currentVenueAdminP.input(CameraPortalInsertSchema).mutation(async ({ ctx, input }) => {
    const inputWithoutIds = _.omit(input, ['fromCameraId', 'toCameraId']);
    const dbResponse = await db.insert(schema.cameraPortals).values(input).onConflictDoUpdate({
      target: [schema.cameraPortals.fromCameraId, schema.cameraPortals.toCameraId],
      set: inputWithoutIds
    }).returning();

    const camera = ctx.stream.cameras.get(input.fromCameraId);
    if(!camera) return;
    camera.reloadDbData('cameraportal upserted');
    camera._notifyStateUpdated('camera portal updated');
    return dbResponse;
  }),
  deleteCameraPortal: currentVenueAdminP.input(z.object({
    fromCameraId: CameraIdSchema,
    toCameraId: CameraIdSchema,
  })).mutation(async ({ctx, input}) => {
    const { fromCameraId, toCameraId } = input;
    const dbResponse = await db.delete(schema.cameraPortals).where(
      and(eq(schema.cameraPortals.fromCameraId, fromCameraId), eq(schema.cameraPortals.toCameraId, toCameraId))
    ).returning();
    const camera = ctx.stream.cameras.get(fromCameraId);
    if(!camera) return;
    camera.reloadDbData('cameraportal deleted');
    camera._notifyStateUpdated('camera portal deleted');
    return dbResponse;
  }),
});
