import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';
import type {} from '@trpc/server';
import type { AppRouter } from 'mediaserver';
import type { inferRouterOutputs } from '@trpc/server';
import { autoGuestToken, latestGuestJwtToken } from '@/modules/authClient';


export type RouterOutputs = inferRouterOutputs<AppRouter>
export const getClient = async () => {
  await autoGuestToken();

  const wsClient = createWSClient({url: `ws://localhost:9001?${latestGuestJwtToken}`});
  const trpcClient = createTRPCProxyClient<AppRouter>({
    links: [
      wsLink({client: wsClient}),
    ],
  });
  console.log(await trpcClient.health.query());

  return trpcClient;
};