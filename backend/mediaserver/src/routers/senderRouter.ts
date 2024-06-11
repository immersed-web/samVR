import { Log } from 'debug-level';
const log = new Log('Router:Sender');
process.env.DEBUG = 'Router:Sender*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { SenderIdSchema, CameraFOVUpdateSchema } from 'schemas';
import { isSenderClientM, procedure as p, router, senderInVenueP } from '../trpc/trpc.js';
import { SenderClient } from '../classes/InternalClasses.js';
import { db, schema } from 'database';
import { eq } from 'drizzle-orm';
// import prismaClient, { cameraIncludeStuff } from '../modules/prismaClient';

const senderClientP = p.use(isSenderClientM);

export const senderRouter = router({
  getClientState: senderClientP.query(({ctx}) => {
    return ctx.client.getPublicState();
  }),
  setSenderId: senderClientP.input(SenderIdSchema).mutation(({ctx, input}) => {

    log.info('received new senderID from client:', input);
    ctx.client.senderId = input;
  }),
  // TODO: Make this part of the camera dashboard instead of sender interface. I.E move to adminrouter and update everything else accordingly
  setCameraFOV: senderInVenueP.input(CameraFOVUpdateSchema).mutation(async ({ ctx, input }) => {
    const [response] = await db.update(schema.cameras)
      .set(input).where(eq(schema.cameras.cameraId, input.cameraId)).returning();
    const camera = ctx.stream.cameras.get(input.cameraId);
    if (!camera) return;
    const { fovStart, fovEnd } = response
    camera.dbData.fovStart = fovStart;
    camera.dbData.fovEnd = fovEnd;
    camera._notifyStateUpdated('FOV updated');
    return response;
  }),
});
