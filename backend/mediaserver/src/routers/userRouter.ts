import { userClientP, procedure as p, router } from '../trpc/trpc.js';

export const userRouter = router({
  getClientState: p.query(({ctx}) => {
    return ctx.client.getPublicState();
  }),
});
