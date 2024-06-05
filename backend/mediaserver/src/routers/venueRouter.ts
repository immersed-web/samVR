import { Log } from 'debug-level';
const log = new Log('Router:Venue');
process.env.DEBUG = 'Router:Venue*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { StreamListInfo, StreamIdSchema } from 'schemas';
import { z } from 'zod';
import { db, schema } from 'database';
import { procedure as p, router, isInVenueM, clientInVenueP } from '../trpc/trpc.js';
import { UserClient, Venue } from '../classes/InternalClasses.js';
import { TRPCError } from '@trpc/server';
import { attachToEvent, attachToFilteredEvent, NotifierInputData, NotifierSignature } from '../trpc/trpc-utils.js';
import { observable } from '@trpc/server/observable';
import { uniqBy } from 'lodash-es';
import { eq } from 'drizzle-orm';

type VenueStateUpdate = NotifierSignature<ReturnType<Venue['getPublicState']>>;

export const venueRouter = router({
  listAllowedVenues: p.query(async ({ctx}) => {
    const publicStreams = await db.query.streams.findMany({
      where: eq(schema.streams.visibility, 'public'),

    })
    // const publicVenues = await prismaClient.venue.findMany({
    //   where: {
    //     visibility: {
    //       equals: 'public'
    //     }
    //   },
    //   select: {
    //     name: true,
    //     venueId: true,
    //     doorsAutoOpen: true,
    //     doorsOpeningTime: true,
    //     doorsManuallyOpened: true,
    //     streamAutoStart: true,
    //     streamStartTime: true,
    //     streamManuallyEnded: true,
    //     streamManuallyStarted: true,
    //     visibility: true,
    //   } satisfies Record<keyof StreamListInfo, true>
    // }) as StreamListInfo[];
    // const assembledVenues = uniqBy([...publicStreams, ...ctx.client..value], 'venueId');

    return publicStreams;
  }),
  getVenueListInfo: p.input(z.object({
    streamId: StreamIdSchema,
  })).query(async ({input, ctx}) => {
    try {
      return await db.query.streams.findFirst({
        where: eq(schema.streams.streamId, input.streamId),
      })
    } catch(e) {
      log.error(e);
      throw new TRPCError({ code: 'NOT_FOUND', message: 'didn\'t find that Venue'});
    }
  }),
  // subClientAddedOrRemoved: p.use(isUserClientM).subscription(({ctx}) => {
  //   return attachToFilteredEvent(ctx.client.clientEvent, 'clientAddedOrRemoved', ctx.connectionId);
  // }),
  // listLoadedVenues: p.query(({ctx}) => {
  //   return Venue.getLoadedVenues();
  // }),
  // listLoadedVenuesPublicState: p.query(({ctx}) => {
  //   return Venue.getLoadedVenuesPublicState();
  // }),
  loadAndJoinStream: p.input(z.object({ streamId: StreamIdSchema })).mutation(async ({ input, ctx }) => {
    await Venue.loadStream(input.streamId, ctx.userId);
    const vState = await ctx.client.joinStream(input.streamId);
    return vState;
  }),
  joinStream: p.input(
    z.object({
      streamId: StreamIdSchema
    })
  ).mutation(async ({input, ctx}) => {
    log.info(`request received to join venue as ${ctx.client.clientType}:`, input.streamId);
    const vState = await ctx.client.joinStream(input.streamId);
    return vState;
  }),
  getVenueState: clientInVenueP.query(({ctx}) => {
    return ctx.venue.getPublicState();
  }),
  subVenueStateUpdated: p.subscription(({ctx}) => {
    log.info(`attaching venueStateUpdated notifier for client: ${ctx.username} (${ctx.connectionId})`);
    return observable<NotifierInputData<VenueStateUpdate>>((scriber) => {
      ctx.client.notify.venueStateUpdated = scriber.next;
      return () => ctx.client.notify.venueStateUpdated = undefined;
    });
  }),
  subVenueUnloaded: p.subscription(({ctx}) => {
    return attachToEvent(ctx.client.clientEvent, 'venueWasUnloaded');
  }),
  // subSomeClientStateUpdated: atLeastModeratorP.subscription(({ctx}) => {
  //   log.info(`${ctx.username} (${ctx.connectionId}) started subscribing to clientState`);
  //   return attachToFilteredEvent(ctx.client.clientEvent, 'someClientStateUpdated', (data) => {
  //     if(data.clientState.connectionId === ctx.connectionId) return false;
  //     if(data.clientState.clientType === 'sender') return false;
  //     return true;
  //   }, ({clientState, reason}) => ({clientState: clientState as ReturnType<UserClient['getPublicState']>, reason}));
  // }),
  leaveCurrentVenue: p.use(isInVenueM).mutation(({ctx}) => {
    if (!ctx.client.leaveCurrentStream()) {
      throw new TRPCError({code: 'PRECONDITION_FAILED', message: 'cant leave if not in a venue.. Duh!'});
    }
  })
});

