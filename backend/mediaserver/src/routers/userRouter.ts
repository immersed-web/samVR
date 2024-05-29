import { attachToEvent } from '../trpc/trpc-utils.js';
import { userClientP, procedure as p, router } from '../trpc/trpc.js';

export const userRouter = router({
  getClientState: p.query(({ctx}) => {
    return ctx.client.getPublicState();
  }),
  subOwnClientState: userClientP.subscription(({ctx}) => {
    return attachToEvent(ctx.client.userClientEvent, 'myStateUpdated');
  }),
});
