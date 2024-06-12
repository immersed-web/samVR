import { defineStore } from 'pinia';

import { type ClientTransform, type ClientTransforms, type ConnectionId, type VrSpaceId, type VrSpaceUpdate } from 'schemas';
import { computed, ref } from 'vue';
import { useConnectionStore } from './connectionStore';
import { eventReceiver, type ExtractPayload, type RouterOutputs, type SubscriptionValue } from '@/modules/trpcClient';
import { useClientStore } from './clientStore';
import { watchIgnorable } from '@vueuse/core';

type _ReceivedVrSpaceState = ExtractPayload<typeof eventReceiver.vrSpace.vrSpaceStateUpdated.subscribe>['data'];

export const useVrSpaceStore = defineStore('vrSpace', () => {
  
  const connection = useConnectionStore();
  const clientStore = useClientStore();

  const currentVrSpace = ref<_ReceivedVrSpaceState>();

  const { ignoreUpdates, } = watchIgnorable(() => currentVrSpace.value, (newVal, oldVal) => {
    console.log('currentVrSpace watcher triggered', oldVal, newVal);
    updateVrSpace();
  }, { deep: true });

  eventReceiver.vrSpace.vrSpaceStateUpdated.subscribe(({ data, reason }) => {
    console.log(`vrSpaceState updated. ${reason}:`, data);
    ignoreUpdates(() => currentVrSpace.value = data);
  });
  
  eventReceiver.vrSpace.clientTransforms.subscribe((data) => {
    console.log(`clientTransforms updated:`, data);
    if (!currentVrSpace.value) return;
    for (const [cId, tsfm] of Object.entries(data)) {
      const cIdTyped = cId as ConnectionId;
      if (clientStore.clientState?.connectionId === cId) {
        // console.log('skipping because is own transform. cId:', cId);
        continue;
      }
      if (!currentVrSpace.value.clients[cIdTyped]) {
        console.warn('received a clientTransform for a client that isnt listed in vrSpaceState');
        return;
      }
      currentVrSpace.value.clients[cId as ConnectionId].transform = tsfm;
    }
  });

  async function createVrSpace(name: string) {
    const vrSpaceId = await connection.client.vr.createVrSpace.mutate({ name });
    return vrSpaceId
    // currentVrSpace.value = 
  }
  
  async function enterVrSpace(vrSpaceId: VrSpaceId) {
    currentVrSpace.value = await connection.client.vr.enterVrSpace.mutate({ vrSpaceId });
  }
  async function leaveVrSpace() {
    await connection.client.vr.leaveVrSpace.mutate();
    currentVrSpace.value = undefined;
  }
  async function updateVrSpace() {
    if (!currentVrSpace.value) return;
    console.log('gonna send update for VrSpace', currentVrSpace.value.dbData);
    await connection.client.vr.updateVrSpace.mutate(currentVrSpace.value.dbData);
  }

  async function updateTransform(transform: ClientTransform){
    await connection.client.vr.transform.updateTransform.mutate(transform);
  }
  
  return {
    currentVrSpace,
    createVrSpace,
    enterVrSpace,
    leaveVrSpace,
    updateVrSpace,
    updateTransform,
  };
});