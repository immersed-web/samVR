import { createTRPCProxyClient, TRPCClientError, wsLink, type CreateTRPCProxyClient } from '@trpc/client';
import type { inferRouterOutputs, inferRouterInputs } from '@trpc/server';
import type { inferObservableValue } from '@trpc/server/observable';
import { createWSClient, wsLink as customWsLink } from './customWsLink';
import type { AppRouter } from 'mediaserver';
import type { UserClientEventMap } from 'mediaserver/user-events'
import type { ClientType, Prettify } from 'schemas';
import superjson from 'superjson';
import { parse } from 'devalue'
import { createReceiver } from 'ts-event-bridge/receiver'
// import { guestAutoToken, loginWithAutoToken, getToken } from '@/modules/authClient';

import { shallowRef, type ShallowRef, computed, type ComputedRef } from 'vue';
import type { Payload } from 'ts-event-bridge/sender';

const wsBaseURL = `wss://${import.meta.env.EXPOSED_SERVER_URL}${import.meta.env.EXPOSED_MEDIASOUP_PATH}`;

const { receiver, onMessageReceived } = createReceiver<UserClientEventMap>({
  onUnhandledEvent(evt, msg) {
    console.warn('unhandled event: ', evt, msg);
  },
  onUnparseableMsg(receivedMsg, error) {
    console.warn('unparseable message: ', receivedMsg, error);
  },
  deserialize: parse
});

export type UnPayload<T extends Payload<any>> = T extends Payload<infer Inner> ? Inner : T;
export type ExtractPayload<T extends (arg: (arg: any) => void) => void> = Parameters<Parameters<T>[0]>[0];
export { receiver as eventReceiver };

export function isTRPCClientError(
  cause: unknown,
): cause is TRPCClientError<AppRouter> {
  return cause instanceof TRPCClientError;
}


export const trpcClient: ShallowRef<CreateTRPCProxyClient<AppRouter> | undefined> = shallowRef();
export const clientOrThrow: ComputedRef<CreateTRPCProxyClient<AppRouter>> = computed(() => {
  if(!trpcClient.value){
    throw Error('tried to access non-existent trpc-client. Very sad!!');
  }
  return trpcClient.value;
});

let _wsClient: ReturnType<typeof createWSClient> | undefined;
export function wsClient() {
  return _wsClient;
}

export function closeClient() {
  if(_wsClient){
    console.log('closing wsLink!');
    _wsClient.close();
    // TODO: Create a pull request that makes the wsClient close if subscriptions are running. Then we wouldnt need to force quite like this:
    try{
      _wsClient.getConnection().close();
    } catch(e){
      console.error('trpc complains. I dont care...');
      // WE expect TRPC to error because for some reason their implementation wont allow any completing the observer by anyone else then the client through unsubscribe.
    }
  }
  trpcClient.value = undefined;
  currentClientType = undefined;
}

let currentClientType: ClientType | undefined;

function buildConnectionUrl(token:string, connectAsSender?: boolean){
  if(connectAsSender){
    return `${wsBaseURL}?token=${token}&sender`;
  }
  return `${wsBaseURL}?token=${token}`;
}

export type RouterOutputs = inferRouterOutputs<AppRouter>
export type RouterInputs = inferRouterInputs<AppRouter>
export type SubscriptionValue<Subscription> = inferObservableValue<Subscription>;

export const createTrpcClient = (getToken: () => string, clientType: ClientType = 'client' ) => {
  if(trpcClient.value && currentClientType === clientType){
    console.warn(`Eeeeeh. You are creating a new (${clientType}) trpc-client when there is already one running. Are you suuure you know what you are doing?? I am rather sure you dont wanna do this :-P`);
  }
  if(_wsClient){
    console.log('closing previous wsLink!');
    _wsClient.close();
    _wsClient.getConnection().close();
  }
  console.log('creating trpc client');
  // await loginWithAutoToken(username, password);
  _wsClient = createWSClient({
    url: () => buildConnectionUrl(getToken(), clientType === 'sender'),
    onUnParseableMessage: (msg) => onMessageReceived(msg),
  });
  trpcClient.value = createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    // transformer: {
    //   serialize: pack,
    //   deserialize: unpack,
    // },
    links: [
      // devtoolsLink(),
      // customWsLink({ client: _wsClient }),
      wsLink({client: _wsClient}),
    ],
  });

  (async () => {
    console.log('###### testing endpoint of new client');
    console.log('client is: ', trpcClient.value);
    try {
      const response = await trpcClient.value?.greeting.query();
      console.log('response:', response);
    } catch(e) {
      console.error(e);
    }
  })();
  currentClientType = clientType;
  // return trpcClient.value;
};
