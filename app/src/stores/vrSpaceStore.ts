import { defineStore } from 'pinia';

import { hasAtLeastPermissionLevel, type ClientRealtimeData, type ClientsRealtimeData, type ConnectionId, type PlacedObjectInsert, type VrSpaceId, type VrSpaceUpdate } from 'schemas';
import { computed, readonly, ref, watch } from 'vue';
import { useConnectionStore } from './connectionStore';
import { eventReceiver, type ExtractPayload, type RouterOutputs, type SubscriptionValue } from '@/modules/trpcClient';
import { useClientStore } from './clientStore';
import { watchIgnorable, pausableWatch } from '@vueuse/core';
import { debounce, throttle } from 'lodash-es';
import { getAssetUrl } from '@/modules/utils';
import { reactive } from 'vue';
import type { PlacedObjectWithIncludes } from 'database';

type _ReceivedVrSpaceState = ExtractPayload<typeof eventReceiver.vrSpace.vrSpaceStateUpdated.subscribe>['data'];


/**
 * The Vr space store
 * There are two versions of the vrSpaceState. CurrentVrSpace and WritableVrSpaceState. 
 * The currentVrSpace should be the one you use in components for reading and showing values.
 * The writableVrSpaceState should be the one you use in components for writing values.
 * There is an ignorable watcher on writableVrSpaceState that will send any updates to the server.
 * Its very important that you wrap any received updates from the server in an ignorable watcher.
 * Otherwise there will be an infinite loop of updates triggering a new update.
 * In other words, only local changes to the writableVrSpaceState should trigger the watcher.
 */

export const useVrSpaceStore = defineStore('vrSpace', () => {

  const connection = useConnectionStore();
  const clientStore = useClientStore();

  const writableVrSpaceState = ref<_ReceivedVrSpaceState>();
  const currentVrSpace = readonly(writableVrSpaceState);

  const worldModelUrl = computed(() => {
    if (!currentVrSpace.value) return undefined;
    const fileName = currentVrSpace.value.dbData.worldModelAsset?.generatedName;
    if (!fileName) return undefined;
    return getAssetUrl(fileName);
  });

  const navMeshUrl = computed(() => {
    if (!currentVrSpace.value) return undefined;
    const fileName = currentVrSpace.value.dbData.navMeshAsset?.generatedName;
    if (!fileName) return undefined;
    return getAssetUrl(fileName);
  });

  const panoramicPreviewUrl = computed(() => {
    if (!currentVrSpace.value) return undefined;
    const fileName = currentVrSpace.value.dbData.panoramicPreview?.generatedName;
    if (!fileName) return undefined;
    return getAssetUrl(fileName);
  });

  const { ignoreUpdates } = watchIgnorable(() => writableVrSpaceState.value, async (newVal, oldVal) => {
    console.log('currentVrSpace watcher triggered', oldVal, newVal);
    if (newVal?.dbData.ownerUserId === clientStore.clientState?.userId
      || newVal?.dbData.allowedUsers.some(p => {
        const permissionMatched = p.user.userId === clientStore.clientState?.userId;
        const isAtLeastEditor = hasAtLeastPermissionLevel(p.permissionLevel, 'edit');
        // console.log(permissionMatched, isAtLeastEditor);
        return permissionMatched && isAtLeastEditor;
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
    // console.log(`clientTransforms updated:`, data);
    if (!writableVrSpaceState.value) return;
    for (const [cId, tsfm] of Object.entries(data)) {
      const cIdTyped = cId as ConnectionId;
      if (clientStore.clientState?.connectionId === cId) {
        // console.log('skipping because is own transform. cId:', cId);
        continue;
      }
      if (!writableVrSpaceState.value.clients[cIdTyped]) {
        console.warn('received a clientTransform for a client that isnt listed in vrSpaceState');
        return;
      }
      ignoreUpdates(() => writableVrSpaceState.value!.clients[cIdTyped].clientRealtimeData = tsfm);
    }
  });

  async function createVrSpace(name: string) {
    const vrSpaceId = await connection.client.vr.createVrSpace.mutate({ name });
    return vrSpaceId;
  }

  async function enterVrSpace(vrSpaceId: VrSpaceId) {
    console.log('gonna enter VrSpace', vrSpaceId);
    const response = await connection.client.vr.enterVrSpace.mutate({ vrSpaceId });

    ignoreUpdates(() => {
      console.log('setting ignored enter response');
      writableVrSpaceState.value = response;
    });
  }
  async function leaveVrSpace() {
    await connection.client.vr.leaveVrSpace.mutate();
    ignoreUpdates(() => writableVrSpaceState.value = undefined);
  }

  async function upsertPlacedObject(placedObject: Omit<PlacedObjectInsert, 'vrSpaceId' | 'reason'>, reason?: string) {
    if (!currentVrSpace.value) {
      console.warn('trying to upsert placedObject but currentVrSpace is undefined');
      return;
    }
    const po: PlacedObjectInsert = { reason, vrSpaceId: currentVrSpace.value?.dbData.vrSpaceId, ...placedObject };
    return connection.client.vr.upsertPlacedObject.mutate(po);
  }

  async function reloadVrSpaceFromDB() {
    await connection.client.vr.reloadVrSpaceFromDB.query();
  }

  /**
   * Debounced update of the backend VrSpaceState.
   */
  const updateVrSpace = debounce(async (reason?: string) => {
    if (!currentVrSpace.value) return;
    console.log(`*** Gonna send update for VrSpace ${currentVrSpace.value.dbData.vrSpaceId}`);

    // @ts-ignore
    await connection.client.vr.updateVrSpace.mutate({ ...currentVrSpace.value.dbData, reason });
  }, 700);

  const ownClientTransform = reactive<ClientRealtimeData>({
    head: {
      active: false,
    },
  });
  watch(() => ownClientTransform, (newT, oldT) => {
    if (!newT) return;
    throttledTransformMutation(newT);
  }, { deep: true });

  const throttledTransformMutation = throttle(async (transform: ClientRealtimeData) => {
    // if(!sceneTag.value?.is('vr-mode')) {
    //   delete currentTransform.leftHand;
    //   delete currentTransform.rightHand;
    // }
    // console.timeEnd('transformSend');
    // console.time('transformSend');
    // if (transform.head.active) {
    //   console.log('gonna update transform', transform.head.position);
    // }
    // console.log('sending transform', transform);
    await connection.client.vr.transform.updateTransform.mutate(transform);
  }, 100, { trailing: true });

  // async function updateTransform(transform: ClientTransform){
  //   await connection.client.vr.transform.updateTransform.mutate(transform);
  // }

  return {
    currentVrSpace,
    writableVrSpaceState,
    worldModelUrl,
    navMeshUrl,
    panoramicPreviewUrl,
    createVrSpace,
    enterVrSpace,
    leaveVrSpace,
    upsertPlacedObject,
    reloadVrSpaceFromDB,
    updateVrSpace,
    // updateTransform,
    ownClientTransform,
  };
});
