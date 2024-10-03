import { defineStore } from 'pinia';

import { hasAtLeastPermissionLevel, PlacedObjectInsertSchema, VrSpaceSelectSchema, type ClientRealtimeData, type ClientsRealtimeData, type ConnectionId, type PlacedObjectId, type PlacedObjectInsert, type Prettify, type VrSpaceId, type VrSpaceSelect, type VrSpaceUpdate } from 'schemas';
import { computed, readonly, ref, watch, type DeepReadonly } from 'vue';
import { useConnectionStore } from './connectionStore';
import { eventReceiver, type ExtractPayload, type RouterOutputs, type SubscriptionValue } from '@/modules/trpcClient';
import { useClientStore } from './clientStore';
import { watchIgnorable, pausableWatch } from '@vueuse/core';
import { debounce, throttle } from 'lodash-es';
import { getAssetUrl } from '@/modules/utils';
import { reactive } from 'vue';

type _ReceivedVrSpaceState = ExtractPayload<typeof eventReceiver.vrSpace.vrSpaceStateUpdated.subscribe>['data'];


/**
 * The Vr space store
 * There are two versions of the vrSpaceState. CurrentVrSpace and WritableVrSpaceState. 
 * The currentVrSpace should be the one you use in components for reading and showing values.
 * The writableVrSpaceState is shallow (doesnt include relations) should be the one you use in components for writing values.
 * There is an ignorable watcher on writableVrSpaceState that will send any updates to the server.
 * Its very important that you wrap any received updates from the server in an ignorable watcher.
 * Otherwise there will be an infinite loop of updates triggering a new update.
 * In other words, only local changes to the writableVrSpaceState should trigger the watcher.
 */

export const useVrSpaceStore = defineStore('vrSpace', () => {

  const connection = useConnectionStore();
  const clientStore = useClientStore();

  const writableVrSpaceDbData = ref<VrSpaceSelect>()
  const currentVrSpace = ref<_ReceivedVrSpaceState>();

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

  const { ignoreUpdates } = watchIgnorable(() => writableVrSpaceDbData.value, async (newVal, oldVal) => {
    console.log('currentVrSpace watcher triggered', oldVal, newVal);
    if (newVal?.ownerUserId === clientStore.clientState?.userId
      || currentVrSpace.value?.dbData.allowedUsers.some(p => {
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
    ignoreUpdates(() => {
      const parsedVrSpaceDbData = VrSpaceSelectSchema.parse(data.dbData);
      console.log('parsedVrSpaceDbData', parsedVrSpaceDbData);
      writableVrSpaceDbData.value = parsedVrSpaceDbData;
    });
    currentVrSpace.value = data;
    console.log('finished setting ignored state update');
  });

  eventReceiver.vrSpace.clientTransforms.subscribe((data) => {
    // console.log(`clientTransforms updated:`, data);
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
      // ignoreUpdates(() => writableVrSpaceDbData.value!.clients[cIdTyped].clientRealtimeData = tsfm);
      currentVrSpace.value!.clients[cIdTyped].clientRealtimeData = tsfm;
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
      const parsedVrSpaceDbData = VrSpaceSelectSchema.parse(response.dbData);
      writableVrSpaceDbData.value = parsedVrSpaceDbData;
    });
    currentVrSpace.value = response;
  }
  async function leaveVrSpace() {
    await connection.client.vr.leaveVrSpace.mutate();
    ignoreUpdates(() => writableVrSpaceDbData.value = undefined);
    currentVrSpace.value = undefined;
  }

  // type PlacedObjectInVrSpaceReceivedState = _ReceivedVrSpaceState['dbData']['placedObjects'][number];

  type PlacedObjectUpsert = Omit<PlacedObjectInsert, 'reason'>;
  async function upsertPlacedObject(placedObject: PlacedObjectUpsert, reason?: string) {
    if (!currentVrSpace.value) {
      console.warn('trying to upsert placedObject but currentVrSpace is undefined');
      return;
    }
    console.log('gonna upsert placedObject. before schema check:', placedObject);
    const parsedPlacedObject = PlacedObjectInsertSchema.parse({ ...placedObject, reason, vrSpaceId: currentVrSpace.value.dbData.vrSpaceId });
    console.log('will send upsert to server. schema-checked placedObject:', parsedPlacedObject);
    return connection.client.vr.upsertPlacedObject.mutate(parsedPlacedObject);
  }

  async function reloadVrSpaceFromDB() {
    await connection.client.vr.reloadVrSpaceFromDB.query();
  }

  async function removePlacedObject(placedObjectId: PlacedObjectId) {
    console.log('gonna remove placedObject', placedObjectId);
    await connection.client.vr.removePlacedObject.mutate({ placedObjectId });
  }

  /**
   * Debounced update of the backend VrSpaceState.
   */
  const updateVrSpace = debounce(async (reason?: string) => {
    if (!currentVrSpace.value) return;
    console.log(`*** Gonna send update for VrSpace ${writableVrSpaceDbData.value?.vrSpaceId}`);

    // @ts-ignore
    await connection.client.vr.updateVrSpace.mutate({ ...writableVrSpaceDbData.value, reason });
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
    // The DeepReadonly type returned from readonly pollutes the typesystem and makes it hard to e.g. use
    // external functions where arguments arent marked as readonly.
    // Soooo. Lets just cast the type back to its mutable version and 
    // rely on runtime warnings triggered when trying to mutate the object.
    currentVrSpace: readonly(currentVrSpace) as typeof currentVrSpace,
    writableVrSpaceDbData,
    worldModelUrl,
    navMeshUrl,
    panoramicPreviewUrl,
    createVrSpace,
    enterVrSpace,
    leaveVrSpace,
    upsertPlacedObject,
    removePlacedObject,
    reloadVrSpaceFromDB,
    updateVrSpace,
    // updateTransform,
    ownClientTransform,
  };
});
