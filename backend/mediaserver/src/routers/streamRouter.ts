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
import { eq } from 'drizzle-orm';

export const streamRouter = router({
  listPublicStreams: p.query(async ({ ctx }) => {
    const publicStreams = await db.query.streams.findMany({
      where: eq(schema.streams.visibility, 'public'),
    })

    return publicStreams;
  }),
  getStreamListInfo: p.input(z.object({
    streamId: StreamIdSchema,
  })).query(async ({ input, ctx }) => {
    try {
      return await db.query.streams.findFirst({
        where: eq(schema.streams.streamId, input.streamId),
      })
    } catch (e) {
      log.error(e);
      throw new TRPCError({ code: 'NOT_FOUND', message: 'didn\'t find that Venue' });
    }
  }),
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
  ).mutation(async ({ input, ctx }) => {
    log.info(`request received to join venue as ${ctx.client.clientType}:`, input.streamId);
    const vState = await ctx.client.joinStream(input.streamId);
    return vState;
  }),
  getStreamState: clientInVenueP.query(({ ctx }) => {
    return ctx.stream.getPublicState();
  }),
  leaveCurrentStream: p.use(isInVenueM).mutation(({ ctx }) => {
    if (!ctx.client.leaveCurrentStream()) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'cant leave if not in a venue.. Duh!' });
    }
  })
});

