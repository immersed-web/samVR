// import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventReceiver, type ExtractPayload } from '@/modules/trpcClient';
import { useConnectionStore } from './connectionStore';
import { ref, computed } from 'vue';

type _ReceivedClientState = ExtractPayload<typeof eventReceiver.user.myStateUpdated.subscribe>['data'];
export const useClientStore = defineStore('client', () => {

  const connection = useConnectionStore();

  if(!connection.clientExists){
    throw Error('This store (clientStore) relies on there being a client created. Make sure to create a connection using the connection store before using this store');
  }

  // TODO: We have a minor trouble here were we will receive either senderclient state or userclient state but treat it as userclient state regardless
  // Its minor because the idea is to only interact with this store if userClient (not if senderCLient).
  // But we should probably make sure the clientState isnt assigned if the user is a senderClient, to help future selfs avoid pain.
  const clientState = ref<_ReceivedClientState>();

  const initials = computed(() => {
    return clientState.value?.username ? clientState.value?.username.split(' ').map(n => n[0]).join('') : '';
  });

  eventReceiver.user.myStateUpdated.subscribe(({ data, reason }) => {
    console.log(`clientState received. Reason: ${reason}`);
    clientState.value = data;
  })

  // const fetchClientState = async () => {
  //   const receivedState = await connection.client.user.getClientState.query();
  //   console.log('manually fetched new clientstate:', receivedState);
  //   clientState.value = receivedState;
  // };

  // const initConnection = async () => {
  //   // clientState.value = await connection.client.user.getClientState.query();
  //   // connection.client.user.subOwnClientState.subscribe(undefined, {
  //   //   onData: (data) => {
  //   //     console.log(`clientState received. Reason: ${data.reason}`);
  //   //     clientState.value = data.myState;
  //   //   },
  //   // });
  // };

  // // Init
  // initConnection();

  return {
    clientState,
    initials,
    // fetchClientState,
  };

});
