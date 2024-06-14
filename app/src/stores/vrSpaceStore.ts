import { defineStore } from 'pinia';

import { hasAtLeastPermissionLevel, type ClientTransform, type ClientTransforms, type ConnectionId, type VrSpaceId, type VrSpaceUpdate } from 'schemas';
import { computed, readonly, ref } from 'vue';
import { useConnectionStore } from './connectionStore';
import { eventReceiver, type ExtractPayload, type RouterOutputs, type SubscriptionValue } from '@/modules/trpcClient';
import { useClientStore } from './clientStore';
import { watchIgnorable, pausableWatch } from '@vueuse/core';
import { debounce, throttle } from 'lodash-es'

type _ReceivedVrSpaceState = ExtractPayload<typeof eventReceiver.vrSpace.vrSpaceStateUpdated.subscribe>['data'];

export const useVrSpaceStore = defineStore('vrSpace', () => {
  
  const connection = useConnectionStore();
  const clientStore = useClientStore();

  const writableVrSpaceState = ref<_ReceivedVrSpaceState>()
  const currentVrSpace = readonly(writableVrSpaceState);


  const { ignoreUpdates } = watchIgnorable(() => writableVrSpaceState.value, async (newVal, oldVal) => {
    // console.log('currentVrSpace watcher triggered', oldVal, newVal);
    if (newVal?.dbData.ownerUserId === clientStore.clientState?.userId
      || newVal?.dbData.allowedUsers.some(p => {
        p.user.userId === clientStore.clientState?.userId && hasAtLeastPermissionLevel(p.permissionLevel, 'edit')
      })) {
      await updateVrSpace();
    }
  }, {
    deep: true,
  });

  eventReceiver.vrSpace.vrSpaceStateUpdated.subscribe(({ data, reason }) => {
    console.log(`vrSpaceState updated. ${reason}:`, data);
    ignoreUpdates(() => writableVrSpaceState.value = data);
    console.log('finished setting ignored state update');
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
  }
  
  async function enterVrSpace(vrSpaceId: VrSpaceId) {
    console.log('gonna enter VrSpace', vrSpaceId);
    const response = await connection.client.vr.enterVrSpace.mutate({ vrSpaceId });

    ignoreUpdates(() => {
      console.log('setting ignored enter response');
      writableVrSpaceState.value = response
    })
  }
  async function leaveVrSpace() {
    await connection.client.vr.leaveVrSpace.mutate();
    ignoreUpdates(() => writableVrSpaceState.value = undefined)
  }

  /**
   * Throttled update of the backend VrSpaceState.
   */
  const updateVrSpace = debounce(async () => {
    if (!currentVrSpace.value) return;
    console.log(`*** Gonna send update for VrSpace ${currentVrSpace.value.dbData.vrSpaceId}`);

    // @ts-ignore
    await connection.client.vr.updateVrSpace.mutate(currentVrSpace.value.dbData);
  }, 700);

  async function updateTransform(transform: ClientTransform){
    await connection.client.vr.transform.updateTransform.mutate(transform);
  }
  
  return {
    currentVrSpace,
    writableVrSpaceState,
    createVrSpace,
    enterVrSpace,
    leaveVrSpace,
    updateVrSpace,
    updateTransform,
  };
});