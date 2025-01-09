import { defineStore } from 'pinia';

import { hasAtLeastPermissionLevel, hasAtLeastSecurityRole, PlacedObjectInsertSchema, VrSpaceSelectSchema, type AssetId, type ClientRealtimeData, type ConnectionId, type PlacedObjectId, type PlacedObjectInsert, type ScreenShare, type VrSpaceId, type VrSpaceSelect } from 'schemas';
import { computed, readonly, ref, watch, type DeepReadonly } from 'vue';
import { useConnectionStore } from './connectionStore';
import { eventReceiver, type ExtractPayload } from '@/modules/trpcClient';
import { useClientStore } from './clientStore';
import { useAuthStore } from './authStore';
import { watchIgnorable } from '@vueuse/core';
import { debounce, isEmpty, omit, remove, throttle } from 'lodash-es';
import { deleteAsset, getAssetUrl } from '@/modules/utils';
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
  const authStore = useAuthStore();

  const writableVrSpaceDbData = ref<VrSpaceSelect>()
  const currentVrSpace = ref<_ReceivedVrSpaceState>();

  function clearStore() {
    ignoreUpdates(() => writableVrSpaceDbData.value = undefined);
    currentVrSpace.value = undefined;
  }

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

  const worldModelScaleString = computed(() => {
    return `${currentVrSpace.value?.dbData.worldModelScale} ${currentVrSpace.value?.dbData.worldModelScale} ${currentVrSpace.value?.dbData.worldModelScale}`
  })

  const panoramicPreviewUrl = computed(() => {
    if (!currentVrSpace.value) return undefined;
    const fileName = currentVrSpace.value.dbData.panoramicPreview?.generatedName;
    if (!fileName) return undefined;
    return getAssetUrl(fileName);
  });

  const screenShares = computed(() => {
    const screenShares = currentVrSpace.value?.screenShares;
    if (!screenShares) return undefined;
    const ownCId = clientStore.clientState!.connectionId;
    const pId = currentVrSpace.value?.clients[ownCId].producers.videoProducer?.producerId;
    if (!pId) return screenShares;
    const filteredScreenShares = omit(screenShares, [pId])
    if (isEmpty(filteredScreenShares)) return undefined;
    return filteredScreenShares;
    // return currentVrSpace.value?.screenShares ?? {};
  });

  const { ignoreUpdates } = watchIgnorable(() => writableVrSpaceDbData.value, async (newVal, oldVal) => {
    console.log('currentVrSpace watcher triggered', oldVal, newVal);
    if (newVal?.ownerUserId === clientStore.clientState?.userId
      || hasAtLeastSecurityRole(authStore.role, 'superadmin')
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
    console.log(`vrSpaceState updated %c[${reason}]:`, 'color: yellow;', data);
    ignoreUpdates(() => {
      const parsedVrSpaceDbData = VrSpaceSelectSchema.parse(data.dbData);
      // console.log('parsedVrSpaceDbData', parsedVrSpaceDbData);
      writableVrSpaceDbData.value = parsedVrSpaceDbData;
    });
    currentVrSpace.value = data;
    // console.log('finished setting ignored state update');
  });

  eventReceiver.vrSpace.vrSpaceWasUnloaded.subscribe(({ vrSpaceId }) => {
    clearStore();
  })

  eventReceiver.vrSpace.clientsRealtimeData.subscribe((data) => {
    // console.log(`clientTransforms updated:`, data);
    if (!currentVrSpace.value) return;
    for (const [cId, realtimeData] of Object.entries(data)) {
      const cIdTyped = cId as ConnectionId;
      if (clientStore.clientState?.connectionId === cId) {
        // console.log('skipping because is own transform. cId:', cId);
        continue;
      }
      if (!currentVrSpace.value.clients[cIdTyped]) {
        console.warn('received a clientTransform for a client that isnt listed in vrSpaceState');
        return;
      }
      currentVrSpace.value!.clients[cIdTyped].clientRealtimeData = realtimeData;
    }
  });

  async function createVrSpace(name: string) {
    const vrSpaceId = await connection.client.vr.createVrSpace.mutate({ name });
    return vrSpaceId;
  }

  async function deleteVrSpace(vrSpaceId?: VrSpaceId) {
    if (!vrSpaceId) vrSpaceId = currentVrSpace.value?.dbData.vrSpaceId;
    if (!vrSpaceId) {
      console.error('deleteVrSpace: no vrspace id provided or no currentvrspace to delete');
      return;
    }
    const deletedVrSpace = await connection.client.vr.deleteVrSpace.mutate({ vrSpaceId });

    const navMeshAssetId = deletedVrSpace.navMeshAssetId as AssetId | null;
    const worldModelAssetId = deletedVrSpace.worldModelAssetId as AssetId | null;
    const panoramicPreviewAssetId = deletedVrSpace.panoramicPreviewAssetId as AssetId | null;
    const authToken = authStore.tokenOrThrow();
    try {
      const wasNavmeshDeleted = navMeshAssetId ? await deleteAsset({ assetId: navMeshAssetId, authToken }) : undefined;
      const wasWorldModelDeleted = worldModelAssetId ? await deleteAsset({ assetId: worldModelAssetId, authToken }) : undefined;
      const wasPanoramicPreviewDeleted = panoramicPreviewAssetId ? await deleteAsset({ assetId: panoramicPreviewAssetId, authToken }) : undefined;
      console.log('asset deletion results:', { wasNavmeshDeleted, wasWorldModelDeleted, wasPanoramicPreviewDeleted });
    } catch (e: unknown) {
      console.error('deletetion of asset(s) failed');
      console.error(e);
    }

    clearStore();
    return deletedVrSpace;
  }

  async function enterVrSpace(vrSpaceId: VrSpaceId) {
    console.log('gonna enter VrSpace', vrSpaceId);
    const response = await connection.client.vr.enterVrSpace.mutate({ vrSpaceId });

    ignoreUpdates(() => {
      // console.log('setting ignored enter response');
      const parsedVrSpaceDbData = VrSpaceSelectSchema.parse(response.dbData);
      writableVrSpaceDbData.value = parsedVrSpaceDbData;
    });
    currentVrSpace.value = response;
  }
  async function leaveVrSpace() {
    clearStore();
    await connection.client.vr.leaveVrSpace.mutate();
  }

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

  async function removePlacedObject(placedObjectId: PlacedObjectId) {
    console.log('gonna remove placedObject', placedObjectId);
    await connection.client.vr.removePlacedObject.mutate({ placedObjectId });
  }

  async function reloadVrSpaceFromDB() {
    await connection.client.vr.reloadVrSpaceFromDB.query();
  }

  async function placeScreenShare(data: ScreenShare) {
    await connection.client.vr.placeScreenShare.mutate(data);
  }

  async function removeScreenShare() {
    await connection.client.vr.removeScreenShare.mutate();
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

  const ownRealtimeData = reactive<ClientRealtimeData>({
    head: {
      active: false,
    },
  });
  watch(() => ownRealtimeData, (newT, oldT) => {
    if (!newT) return;
    throttledRealtimeDataUpdate(newT);
  }, { deep: true });

  const throttledRealtimeDataUpdate = throttle(async (realtimeData: ClientRealtimeData) => {
    if (!currentVrSpace.value) return;
    await connection.client.vr.updateRealtimeData.mutate(realtimeData);
  }, 100, { trailing: true });

  return {
    // The DeepReadonly type returned from readonly pollutes the typesystem and makes it hard to e.g. use
    // external functions where arguments arent marked as readonly.
    // Soooo. Lets just cast the type back to its mutable version and 
    // rely on runtime warnings triggered when trying to mutate the object.
    currentVrSpace: readonly(currentVrSpace) as typeof currentVrSpace,
    writableVrSpaceDbData,
    worldModelUrl,
    navMeshUrl,
    worldModelScaleString,
    panoramicPreviewUrl,
    createVrSpace,
    deleteVrSpace,
    enterVrSpace,
    leaveVrSpace,
    upsertPlacedObject,
    removePlacedObject,
    reloadVrSpaceFromDB,
    placeScreenShare,
    removeScreenShare,
    // updateVrSpace,
    // updateTransform,
    ownRealtimeData,
    screenShares,
  };
});
