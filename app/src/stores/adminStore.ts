import type { SubscriptionValue, RouterOutputs, ExtractPayload } from '@/modules/trpcClient';
import { defineStore } from 'pinia';
import type { CameraId, SenderId, StreamId, CameraPortalInsert, CameraInsert, ConnectionId, CameraUpdate } from 'schemas';
import { computed, ref } from 'vue';
import { useConnectionStore } from './connectionStore';
import { useStreamStore } from './streamStore';
import { useSoupStore } from './soupStore';
import { useNow } from '@vueuse/core';
import { eventReceiver, type UnPayload } from '@/modules/trpcClient';

// type _ReceivedAdminStreamState = SubscriptionValue<RouterOutputs['admin']['subStreamStateUpdated']>['data'];
type _ReceivedAdminStreamState = ExtractPayload<typeof eventReceiver.stream.streamStateUpdatedAdminOnly.subscribe>['data'];
export const useAdminStore = defineStore('admin', () => {
  const streamStore = useStreamStore();
  const connection = useConnectionStore();
  const now = useNow({interval: 1000});

  const adminOnlyStreamState = ref<_ReceivedAdminStreamState>();

  // connection.client.admin.subStreamStateUpdated.subscribe(undefined, {
  //   onData({data, reason}){
  //     console.log('streamState (adminonly) updated:', { data, reason });
  //     adminOnlyStreamState.value = data;
  //   },
  // });

  eventReceiver.stream.streamStateUpdatedAdminOnly.subscribe(payload => {
    adminOnlyStreamState.value = payload.data;
  });

  // connectionStore.client.admin.subSenderAddedOrRemoved.subscribe(undefined, {
  //   onData({data, reason}) {
  //     console.log('senderAddedOrRemoved triggered!:', data, reason);
  //     const client = data.senderState;
  //     if(data.added){
  //       connectedSenders.set(client.connectionId ,client);
  //     } else {
  //       connectedSenders.delete(client.connectionId);
  //     }
  //   },
  // });

  // connectionStore.client.admin.subProducerCreated.subscribe(undefined, {
  //   onData(data) {
  //     console.log('received new producer:', data);
  //     const { producingConnectionId, producer } = data;
  //     const sender = connectedSenders.get(producingConnectionId);
  //     if(!sender) {
  //       console.warn('The created producer wasnt in the list of connected senders. Perhaps a normal user?');
  //       return;
  //     }
  //     sender.producers[producer.producerId] = producer;
  //     connectedSenders.set(producingConnectionId, sender);
  //   },
  // });

  async function createStream() {
    const streamId = await connection.client.admin.createNewStream.mutate({ name: `event-${Math.trunc(Math.random() * 1000)}` });
    await loadAndJoinStreamAsAdmin(streamId);
    console.log('Created, loaded and joined stream', streamId);
  }

  async function deleteCurrentStream() {
    if (streamStore.currentStream?.streamId) {
      const streamId = streamStore.currentStream.streamId;
      await streamStore.leaveStream();
  // TODO: Make all other clients leave stream, too
      await connection.client.admin.deleteStream.mutate({ streamId });
    }
  }

  async function loadAndJoinStreamAsAdmin(streamId: StreamId) {
    const { publicStreamState: publicVenueState, adminOnlyStramState: aOnlyState } = await connection.client.admin.loadAndJoinStream.mutate({ streamId });
    streamStore.currentStream = publicVenueState;
    adminOnlyStreamState.value = aOnlyState;
  }
  
  async function updateCamera(input: CameraUpdate, reason?: string) {
    await connection.client.admin.updateCamera.mutate({ ...input, reason });
  }

  async function createCameraFromSender(cameraName: string, senderId: SenderId){
    await connection.client.admin.createCamera.mutate({name: cameraName, senderId});
  }
  
  async function setSenderForCamera(cameraId: CameraId, senderId: SenderId) {
    await connection.client.admin.setSenderForCamera.mutate({cameraId, senderId});
  }
  
  async function setPortal(data: CameraPortalInsert) {
    await connection.client.admin.setCameraPortal.mutate(data);
  }
  
  async function deletePortal(fromCameraId:CameraId, toCameraId: CameraId) {
    await connection.client.admin.deleteCameraPortal.mutate({
      fromCameraId,
      toCameraId,
    });
  }

  async function deleteCamera(cameraId: CameraId){
    await connection.client.admin.deleteCamera.mutate({cameraId});
  }
  
  async function consumeDetachedSenderVideo(connectionId: ConnectionId) {
    if (!adminOnlyStreamState.value?.detachedSenders) {
      console.warn('detachedSenders undefined!');
      return;
    }
    const p = adminOnlyStreamState.value?.detachedSenders[connectionId].producers;
    if(p === undefined) return;
    if(!p.videoProducer) return;
    const soup = useSoupStore();
    soup.closeAllConsumers();
    return soup.consume(p.videoProducer.producerId);
    // const response = await connection.client.soup.createConsumer.mutate({ producerId:p.videoProducer?.producerId});
  }
  
  // /** 
  //  * We have slightly different implementations in admin and venuestore. Use this one for admins only. Normal users should have the "spreaded" version
  // */
  // const realSecondsUntilDoorsOpen = computed(() => {
  //   if (!venueStore.currentStream?.vrSpace || !venueStore.currentStream?.doorsAutoOpen || !venueStore.currentStream.doorsOpeningTime || venueStore.currentStream.doorsManuallyOpened) return undefined;
  //   const millis = venueStore.currentStream.doorsOpeningTime.getTime() - now.value.getTime();
  //   return Math.trunc(Math.max(0, millis*0.001));
  // });

  // const realDoorsAreOpen = computed(() => {
  //   if (!venueStore.currentStream) return false;
  //   if(realSecondsUntilDoorsOpen.value !== undefined){
  //     return realSecondsUntilDoorsOpen.value === 0;
  //   }
  //   else return venueStore.currentStream.doorsManuallyOpened;
  // });


  return {
    adminOnlyStreamState,
    // realSecondsUntilDoorsOpen,
    // realDoorsAreOpen,
    createStream,
    loadAndJoinStreamAsAdmin,
    deleteCurrentStream,
    createCameraFromSender,
    setSenderForCamera,
    updateCamera,
    setPortal,
    deletePortal,
    deleteCamera,
    consumeDetachedSenderVideo,
  };
});
