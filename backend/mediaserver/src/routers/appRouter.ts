import { Log } from 'debug-level';
const log = new Log('AppRouter');
process.env.DEBUG = 'AppRouter*, ' + process.env.DEBUG;
log.enable(process.env.DEBUG);

import { router, procedure } from '../trpc/trpc.js';
import { soupRouter } from './soupRouter.js';
import { vrRouter } from './vrRouter.js';
import { streamRouter } from './streamRouter.js';
import { TypedEmitter } from 'tiny-typed-emitter';
import { userRouter } from './userRouter.js';
import { senderRouter } from './senderRouter.js';
import { adminRouter } from './adminRouter.js';
import { cameraRouter } from './cameraRouter.js';

const appRouterEvents = new TypedEmitter<{
  'heartbeat': (msg: string) => void
}>();
setInterval(() => appRouterEvents.emit('heartbeat', `heartBeat at ${Date.now()}`), 5000);

export const appRouter = router({
  user: userRouter,
  sender: senderRouter,
  admin: adminRouter,
  stream: streamRouter,
  camera: cameraRouter,
  soup: soupRouter,
  vr: vrRouter,
  greeting: procedure.query(({ctx}) => `Hello ${ctx.username}!`),
  health: procedure.query(({ctx}) => {
    return 'Yooo! I\'m healthy' as const;
  }),
});

export type AppRouter = typeof appRouter;
