<template>
  <h1 class=" text-3xl font-bold">
    Redigera {{ vrSpaceStore.writableVrSpaceDbData?.name }}
  </h1>
  <div v-if="!vrSpaceStore.writableVrSpaceDbData">
    Laddar...
  </div>
  <div v-else class="grid grid-cols-[2fr_3fr] gap-2">
    <!-- COLUMN 1 -->
    <div class="join join-vertical w-full">
      <div class="collapse collapse-arrow join-item border-base-300 border">
        <input type="checkbox" name="settings-accordion" false-value="" true-value="basicSettings"
          v-model="activeAccordion">
        <div class="collapse-title bg-gray-100">
          Grundläggande information
        </div>
        <div class="collapse-content flex flex-col items-start space-y-4">
          <div class="w-full">
            <div class="divider">
              Scenens namn
            </div>
            <p class="text-sm mb-2 text-gray-600">
              Ange ett namn för VR-scenen som är synligt för andra användare och besökare.
            </p>
            <div>
              <label class="flex flex-col gap-1">
                <span class="label-text font-semibold">Scenens namn</span>
              </label>
              <input class="input input-bordered input-sm" v-model="vrSpaceStore.writableVrSpaceDbData.name">
            </div>
          </div>
        </div>
      </div>
      <div class="collapse collapse-arrow join-item border-base-300 border">
        <input type="checkbox" name="settings-accordion" true-value="usersettings" false-value=""
          v-model="activeAccordion">
        <div class="collapse-title bg-gray-100">
          Användare och rättigheter
        </div>
        <div class="collapse-content flex flex-col items-start space-y-4">
          <div class="w-full">
            <div class="divider">
              Publik eller privat?
            </div>
            <p class="text-sm mb-2 text-gray-600">
              Välj ifall VR-scenen ska vara publikt tillgänglig, öppen för vem som helst att besöka. Eller om scenen
              är privat för dig och de
              du har valt att dela den med.
            </p>
            <label class="max-w-sm label cursor-pointer gap-2 font-semibold">
              <span class="label-text">
                Öppet för alla:
              </span>
              <input type="checkbox" class="toggle toggle-success" true-value="public" false-value="private"
                v-model="vrSpaceStore.writableVrSpaceDbData.visibility">
            </label>
          </div>
          <div class="w-full">
            <div class="divider">
              Delning
            </div>
            <p class="text-sm mb-2 text-gray-600">
              Välj de användare som ska ha tillgång till scenen, samt på vilken nivå de ska ha tillgång.
            </p>
            <span class="label-text font-semibold whitespace-nowrap">
              Dela med en ny person
            </span>
            <div class="flex gap-2 justify-between items-center z-10">
              <AutoComplete v-if="users?.length" class="grow" v-model="selectedUser" display-key="username"
                id-key="userId" :options="users" />
              <select v-model="selectedPermission" class="select select-bordered select-sm">
                <option :value="permissionLevel" v-for="permissionLevel in insertablePermissionHierarchy"
                  :key="permissionLevel">
                  {{ permissionLevel }}
                </option>
              </select>
              <button :disabled="!selectedUser" @click="addEditPermission" class="btn btn-primary btn-sm">
                Lägg till {{ selectedUser?.username }}: {{ selectedPermission }}
              </button>
            </div>
            <!-- <p>{{ selectedUser }}</p> -->
            <!-- <p class="overflow-hidden">{{ users }}</p> -->

            <div class="flex flex-col gap-1 mt-2">
              <span class="label-text font-semibold whitespace-nowrap">
                Personer med tillgång till VR-scenen
              </span>
              <div v-for="userPermission in vrSpaceStore.currentVrSpace?.dbData.allowedUsers"
                :key="userPermission.user.userId">
                {{ userPermission.user.username }}: {{ userPermission.permissionLevel }}
                <button @click="removeEditPermission(userPermission.user.userId)">x</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="collapse collapse-arrow join-item border-base-300 border">
        <input type="checkbox" name="settings-accordion" true-value="modelsettings" false-value=""
          v-model="activeAccordion">
        <div class="collapse-title bg-gray-100">
          3D-modell
        </div>
        <div class="collapse-content flex flex-col items-start space-y-4">
          <template v-if="vrSpaceStore.currentVrSpace">
            <div class="w-full">
              <div class="divider">
                Himlens färg
              </div>
              <p class="text-sm mb-2 text-gray-600">
                Välj den färg som himlen ska ha i VR-scenen.
              </p>
              <label class="flex flex-col gap-1">
                <span class="label-text font-semibold whitespace-nowrap">
                  Himlens färg
                </span>
                <input class="rounded-md border-black border-2" type="color"
                  v-model="vrSpaceStore.writableVrSpaceDbData.skyColor">
              </label>
            </div>
            <div class="w-full">
              <div class="divider">
                3D-modell för miljön
              </div>
              <p class="text-sm mb-2 text-gray-600">
                Ladda upp en 3D-modell för VR-scenens miljö. Detta är den modell som omsluter besökaren, t.ex. ett
                rum eller en park.
              </p>
              <pre>{{ vrSpaceStore.currentVrSpace.dbData.worldModelAsset?.originalFileName }}</pre>
              <AssetUpload @uploaded="onModelUploaded" :accepted-asset-types="['model']" name="miljömodell"
                :show-in-user-library="false" :uploaded-asset-data="vrSpaceStore.currentVrSpace.dbData.worldModelAsset"
                @asset-deleted="vrSpaceStore.reloadVrSpaceFromDB" />
            </div>

            <template v-if="vrSpaceStore.currentVrSpace.dbData.worldModelAsset">
              <div class="w-full">
                <div class="divider">
                  3D-modell för gåbara ytor (navmesh)
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Ladda upp en 3D-modell för miljöns navmesh. Modellen anger var besökarna kan röra sig fritt samt
                  vilka ytor som inte går att beträda. Ifall en navmesh-modell inte laddas upp så försöker programmet
                  att beräkna detta automatiskt, vilket kan ge upphov till oväntade fel.
                </p>
                <pre>{{ vrSpaceStore.currentVrSpace.dbData.navMeshAsset?.originalFileName }}</pre>
                <AssetUpload @uploaded="onNavmeshUploaded" accepted-asset-types="navmesh" name="navmesh"
                  :show-in-user-library="false" :uploaded-asset-data="vrSpaceStore.currentVrSpace.dbData.navMeshAsset"
                  @asset-deleted="vrSpaceStore.reloadVrSpaceFromDB" />
              </div>

              <!-- Startplats -->
              <div class="w-full">
                <div class="divider">
                  Startplats för besökare
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Välj den plats där besökare startar då de öppnar VR-scenen.
                  Klicka på knappen nedan och sedan i 3D-modellen för att placera startplatsen.
                  Du kan ändra storlek på startplatsen för att slumpa startpositionen inom den gula cirkeln.
                </p>
                <div class="grid grid-cols-2 w-full">
                  <div class="tooltip tooltip-right flex"
                    data-tip="Klicka sedan i 3D-scenen för att välja var besökarna startar">
                    <!-- <input type="radio" value="spawnPosition" aria-label="Placera startplats"
                        class="btn btn-sm btn-primary"
                        :class="{ activeRaycast: currentRaycastReason == 'spawnPosition' }"
                        v-model="currentRaycastReason"> -->
                    <button class="btn btn-sm btn-primary" @click="setCursorMode('place-spawnposition')">
                      Placera
                      startplats
                    </button>
                  </div>
                  <div>
                    <label class="flex flex-col gap-1">
                      <span class="label-text font-semibold whitespace-nowrap">
                        Startplatsens storlek
                      </span>
                      <input type="range" min="0.5" max="8" step="0.1"
                        v-model.number="vrSpaceStore.writableVrSpaceDbData.spawnRadius" class="range">
                    </label>
                  </div>
                </div>
              </div>

              <!-- Portaler -->
              <div class="w-full">
                <div class="divider">
                  Portaler till andra VR-scener
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Skapa portaler som låter besökarna förflytta sig till andra VR-scener. Välj en scen att förflytta
                  sig till
                  och klicka sedan i 3D-modellen för att placera portalen.
                </p>
                <div>
                  <label class="flex flex-col gap-1">
                    <span class="label-text font-semibold">Skapa ny portal</span>
                  </label>
                  <!-- <p>{{ portalTargetVrSpace }}</p> -->
                  <AutoComplete v-if="allowedVrSpaces?.length" v-model="portalTargetVrSpace" :options="allowedVrSpaces"
                    display-key="name" id-key="vrSpaceId" />
                  <!-- <select class="select select-sm select-bordered" v-model="portalTargetVrSpace"
                      @change="isRaycastingActive = true">
                      <option v-for="vrSpace in allowedVrSpaces" :key="vrSpace.vrSpaceId" :value="vrSpace.vrSpaceId">
                        {{
                        vrSpace.name }}
                      </option>
                    </select> -->
                </div>
              </div>

              <!-- Placera objekt -->
              <div class="w-full">
                <div class="divider">
                  Placera objekt
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Placera objekt såsom bilder och PDF i 3D-modellen.
                </p>
                <div>
                  <AssetUpload @uploaded="onAssetUploaded" :accepted-asset-types="['document', 'image', 'video']"
                    name="object" :show-in-user-library="true" />
                </div>
                <!-- <div v-if="clientStore.clientState?.assets" class="grid gap-2 grid-cols-[auto_auto] max-h-64 overflow-y-auto">
          <template v-for="asset in clientStore.clientState.assets" :key="asset.assetId">
            <div>{{ asset.originalFileName }}</div>
            <button class="btn btn-sm btn-secondary">
              placera
            </button>
          </template>
        </div> -->
                <AssetLibrary :assets="libraryAssets" @asset-picked="onAssetPicked" />
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- COLUMN -->
    <div>
      <div class="sticky top-2">
        <VrSpacePreview class="border rounded-md overflow-hidden" ref="vrComponentTag"
          :model-url="vrSpaceStore.worldModelUrl" :navmesh-url="vrSpaceStore.navMeshUrl"
          :raycastSelector="raycastSelector"
          :auto-rotate="currentCursorMode === undefined && selectedPlacedObject === undefined">
          <a-entity v-if="!hideGizmos" id="placed-objects">
            <template v-for="placedObject in placedObjectsSelectFiltered" :key="placedObject.placedObjectId">
              <template v-if="placedObject.type === 'vrPortal'">
                <VrSpacePortal :key="placedObject.placedObjectId" @click.stop="selectedPlacedObject = placedObject"
                  :position="placedObject.position?.join(' ')" :vr-portal="placedObject.vrPortal"
                  class="selectable-object" :label="placedObject.vrPortal?.name" />
              </template>
              <template v-else-if="placedObject.type === 'asset' && placedObject.asset">
                <PlacedAsset :key="placedObject.placedObjectId" @click="selectedPlacedObject = placedObject"
                  :rotation="arrToCoordString(quaternionTupleToAframeRotation(placedObject.orientation ?? [0, 0, 0, 1]))"
                  :position="arrToCoordString(placedObject.position)" class="selectable-object"
                  :scale="placedObject.scale ? arrToCoordString(placedObject.scale) : ''" :asset="placedObject.asset" />
              </template>
            </template>
            <template v-if="transformedSelectedObject">
              <VrSpacePortal :key="`selected-${transformedSelectedObject.placedObjectId}`"
                v-if="transformedSelectedObject.type === 'vrPortal'" show-box-helper
                :position="transformedSelectedObject.position?.join(' ')"
                :vr-portal="transformedSelectedObject.vrPortal" :label="'markerad'" />
              <PlacedAsset v-else-if="transformedSelectedObject.type === 'asset' && transformedSelectedObject.asset"
                :key="transformedSelectedObject.placedObjectId" box-helper
                :rotation="arrToCoordString(quaternionTupleToAframeRotation(transformedSelectedObject.orientation ?? [0, 0, 0, 1]))"
                :position="arrToCoordString(transformedSelectedObject.position)" class="selectable-object"
                :scale="transformedSelectedObject.scale ? arrToCoordString(transformedSelectedObject.scale) : ''"
                :asset="transformedSelectedObject.asset" />
            </template>
          </a-entity>

          <a-entity ref="spawnPosTag" v-if="spawnPosString" :position="spawnPosString">
            <a-circle color="yellow" transparent="true" rotation="-90 0 0" position="0 0.05 0"
              :opacity="currentCursorMode === 'place-spawnposition' ? 0.2 : 0.5"
              :radius="vrSpaceStore.writableVrSpaceDbData.spawnRadius" />
            <a-icosahedron v-if="vrSpaceStore.panoramicPreviewUrl" detail="5" scale="-0.5 -0.5 -0.5"
              :position="`0 ${defaultHeightOverGround} 0`"
              :opacity="currentCursorMode === 'place-spawnposition' ? 0.5 : 1.0"
              :material="`shader: pano-portal; warpParams: 3 0.9; src: ${vrSpaceStore.panoramicPreviewUrl};`" />
          </a-entity>
          <a-entity id="teleport-target-aframe-cursor" ref="cursorEntity">
            <a-ring :visible="currentCursorMode !== undefined" color="yellow" radius-inner="0.1" radius-outer="0.2"
              material="shader: flat; side: double;" rotation="0 0 0" />
          </a-entity>
          <!-- <PlacablesTeleport /> -->
          <!-- <a-entity :position="hoverPosString" :visible="hoverPosString !== undefined">
              <a-ring color="yellow" radius-inner="0.1" radius-outer="0.2" material="shader: flat;"
                rotation="-90 0 0" />
            </a-entity> -->
        </VrSpacePreview>
        <button v-if="currentCursorMode || selectedPlacedObject" class="btn btn-sm btn-circle"
          @click="setCursorMode(undefined); selectedPlacedObject = undefined">
          <span class="material-icons">close</span>
        </button>
        <pre
          class="text-xs">qToAframe(sPo): {{ quaternionTupleToAframeRotation(selectedPlacedObject?.orientation ?? [0, 0, 0, 1]) }}</pre>
        <pre class="text-xs">composable rotation ref: {{ placedObjectRotation }}</pre>
        <pre class="text-xs">sPO orientation: {{ selectedPlacedObject?.orientation }}</pre>
        <pre class="text-xs">tsPO orientation: {{ transformedSelectedObject?.orientation }}</pre>
        <!-- 
        <pre>{{ selectedPlacedObject?.position }}</pre>
        <pre>{{ vrSpaceStore.currentVrSpace?.dbData.placedObjects.find(p => p.placedObjectId === selectedPlacedObject?.placedObjectId)?.position }}</pre> -->
        <!-- <button class="btn btn-accent" @click="isRaycastingActive = !isRaycastingActive;">toggle raycasting</button> -->
        <template v-if="vrSpaceStore.currentVrSpace?.dbData.worldModelAsset">
          <h4>Interagera med VR-scenen</h4>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <!-- Hoppa in i världen -->
              <div>
                <!-- <input type="radio" :value="undefined" class="hidden" v-model="currentRaycastReason"> -->
                <!-- <input v-if="!(vrComponentTag?.firstPersonViewActive || currentRaycastReason === 'selfPlacement')"
                    type="radio" value="selfPlacement" aria-label="Hoppa in i scenen" class="btn btn-sm btn-primary"
                    v-model="currentRaycastReason"> -->
                <pre>{{ currentCursorMode }}</pre>
                <button v-if="!vrComponentTag?.firstPersonViewActive" @click="setCursorMode('enterFirstPersonView')"
                  class="btn btn-primary btn-sm">
                  Hoppa in i scenen
                </button>
                <button v-else @click="vrComponentTag?.exitFirstPersonView" class="btn btn-primary btn-sm">
                  Hoppa ut ur
                  scenen
                </button>
              </div>
            </div>
            <div>
              <p class="text-bold">
                Perspektiv: {{ vrComponentTag?.firstPersonViewActive ? 'Förstaperson' : 'Helikopter' }}
              </p>
              <div class="text-xs">
                <div>
                  <ul v-if="vrComponentTag?.firstPersonViewActive" class="list-disc">
                    <li>Rör dig runt med tangentbordet: WASD</li>
                    <li>Klicka och dra: Rotera</li>
                  </ul>
                  <ul v-else>
                    <li>Klicka och dra: Rotera bilden</li>
                    <li>Högerklick och dra: Panorera längs golvytan</li>
                    <li>Scrolla: Zooma</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AssetUpload, { type AssetUploadEmitUploadedPayload } from './AssetUpload.vue';
import VrSpacePreview from '@/components/lobby/VrSpacePreview.vue';
import { ref, watch, onMounted, computed, toRaw, toValue, type ComponentInstance, nextTick, type DeepReadonly } from 'vue';
// import { throttle } from 'lodash-es';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from '@headlessui/vue';
import { insertablePermissionHierarchy, type PlacedObject, type Asset, type PlacedObjectId, type VrSpaceId, defaultHeightOverGround, type UserId } from 'schemas';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import type { RouterOutputs } from '@/modules/trpcClient';
// import UserBanner from '@/components/UserBanner.vue';
import AssetLibrary from '@/components/lobby/AssetLibrary.vue';
import { getAssetUrl, uploadFileData } from '@/modules/utils';
import VrSpacePortal from '@/components/entities/VrSpacePortal.vue';
import AutoComplete from '@/components/AutoComplete.vue';
import { useCurrentCursorIntersection, useSelectedEntity, useSelectedPlacedObject } from '@/composables/vrSpaceComposables';
import { THREE, type Entity } from 'aframe';
import { arrToCoordString, isEntity, quaternionTupleToAframeRotation } from '@/modules/3DUtils';
import type { PlacedObjectWithIncludes } from 'database';
import { watchDebounced } from '@vueuse/core';
import PlacablesTeleport from './lobby/teleports/PlacablesTeleport.vue';
import PlacedAsset from '@/components/lobby/PlacedAsset.vue';
import OffsetSlider from '@/components/OffsetSlider.vue';

const testNumber = ref(10);

// TODO: refine/find alternative way to get these types so we get intellisense for the emit key
type ExtractEmitData<T extends string, emitUnion extends (...args: any[]) => void> = T extends Parameters<emitUnion>[0] ? Parameters<emitUnion>[1] : never
type ScreenshotPayload = ExtractEmitData<'screenshot', ComponentInstance<typeof VrSpacePreview>['$emit']>

// const selectedPlacedObject = ref<DeepReadonly<PlacedObjectWithIncludes>>();
const { selectedPlacedObject, placedObjectPosition: selectedPosition, placedObjectRotation, transformedSelectedObject, onTransformUpdate } = useSelectedPlacedObject();

// watchDebounced(transformedSelectedObject, (updatedPO, oldPO) => {
//   console.log('selectedPlacedObject changed', updatedPO, oldPO);
//   if (!updatedPO || !oldPO) {
//     return;
//   }
//   const uPO = updatedPO as PlacedObjectWithIncludes;
//   vrSpaceStore.upsertPlacedObject(uPO)
// }, { deep: true, debounce: 400, maxWait: 1500 });
onTransformUpdate(spo => {
  const transformedPO = spo as PlacedObjectWithIncludes;
  console.log('selected object transform hook triggered');
  // const pos = transformedPO.orientation
  vrSpaceStore.upsertPlacedObject(transformedPO);
})
// watchDebounced(() => transformedSelectedObject.value?.position, (updatedPosition, oldPosition) => {

//   if (!transformedSelectedObject.value) return;
//   const transformedPO = transformedSelectedObject.value as PlacedObjectWithIncludes;
//   console.log('transformed selected object position changed');
//   // const pos = transformedPO.orientation
//   vrSpaceStore.upsertPlacedObject(transformedPO);
// }, { deep: true, debounce: 400, maxWait: 1500 });

const placedObjectsSelectFiltered = computed(() => {
  return vrSpaceStore.currentVrSpace?.dbData.placedObjects.filter(po => po.placedObjectId !== selectedPlacedObject.value?.placedObjectId) ?? [];
})

const { setCursorMode, currentCursorMode, setCursorEntityRef, onCursorClick, currentCursorIntersection, triggerCursorClick } = useCurrentCursorIntersection();
watch(currentCursorIntersection, (intersection) => {
  if (currentCursorMode.value === 'place-spawnposition') {
    uncommitedSpawnPosition.value = intersection?.intersection.point?.toArray() ?? [0, 0, 0];
  }
});

const raycastSelector = computed(() => {
  if (!currentCursorMode.value) return '.selectable-object';
  return '.selectable-object, .raycastable-surface';
});

// Use imports
// const router = useRouter();
const backendConnection = useConnectionStore();
const vrSpaceStore = useVrSpaceStore();
const authStore = useAuthStore();
const clientStore = useClientStore();
const cursorEntity = ref<Entity>();
setCursorEntityRef(cursorEntity);

const activeAccordion = ref<string>();

const libraryAssets = computed(() => {
  return clientStore.clientState?.assets.filter(a => a.showInUserLibrary) ?? [];
});

const vrComponentTag = ref<ComponentInstance<typeof VrSpacePreview>>();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();

onCursorClick(async (e) => {
  console.log('raycast click:', e);
  const point = e.detail.intersection.point.toArray();
  const cursorMode = currentCursorMode.value;

  setCursorMode(undefined);
  if (!cursorMode) {
    // const target = e.target;
    // if (!target || !isEntity(target)) return;
    // selectedEntity.value = target;
  } else {
    switch (cursorMode) {
      case 'enterFirstPersonView':
        vrComponentTag.value?.enterFirstPersonView(point);
        break;
      case 'place-vrPortal':
        if (!vrSpaceStore.writableVrSpaceDbData || !portalTargetVrSpace.value) return;
        console.log(portalTargetVrSpace.value);
        const vrSpaceId = portalTargetVrSpace.value.vrSpaceId;
        backendConnection.client.vr.upsertPlacedObject.mutate({
          vrSpaceId: vrSpaceStore.writableVrSpaceDbData.vrSpaceId,
          type: 'vrPortal',
          objectId: vrSpaceId,
          position: point,
          orientation: new THREE.Quaternion().identity().toArray() as [number, number, number, number],
        });
        break;
      case 'place-spawnposition':
        if (!vrSpaceStore.writableVrSpaceDbData) return;
        hideGizmos.value = true;
        vrSpaceStore.writableVrSpaceDbData.spawnPosition = point;
        const canvas = await vrComponentTag.value?.getPanoScreenshotFromPoint(point);
        if (!canvas) return;
        uploadScreenshot(canvas);
        hideGizmos.value = false;
        break;
    }
  }
});

function onAssetUploaded(uploadDetails: AssetUploadEmitUploadedPayload) {
  console.log(uploadDetails);
  // TODO: We should probalby have the server notify a clientstate update
  // right now we just do this hack to keep assets in local clientState in sync with db.
  // This means the server client instance is not updated with the new asset.
  // @ts-ignore
  clientStore.clientState?.assets.push(uploadDetails);
}

function onAssetPicked(asset: Asset) {
  console.log(asset);
}

function onModelUploaded(uploadDetails: AssetUploadEmitUploadedPayload) {
  console.log(uploadDetails);
  if (!vrSpaceStore.writableVrSpaceDbData) return;
  vrSpaceStore.writableVrSpaceDbData.worldModelAssetId = uploadDetails.assetId;
}

function onNavmeshUploaded(uploadDetails: AssetUploadEmitUploadedPayload) {
  console.log(uploadDetails);
  if (!vrSpaceStore.writableVrSpaceDbData) return;
  vrSpaceStore.writableVrSpaceDbData.navMeshAssetId = uploadDetails.assetId;
}

const hideGizmos = ref(false);
const uncommitedSpawnPosition = ref<THREE.Vector3Tuple>();
const spawnPosString = computed(() => {
  if (hideGizmos.value) return undefined;
  // const posArr = vrSpaceStore.currentVrSpace?.dbData.spawnPosition;
  const posArr = uncommitedSpawnPosition.value;
  if (!posArr) return undefined;
  return arrToCoordString(posArr);
  // const v = new AFRAME.THREE.Vector3(...posArr);
  // return AFRAME.utils.coordinates.stringify(v);
});

// const query = ref('');
const users = ref<RouterOutputs['user']['getAllUsers']>();
// const filteredUsers = computed(() => users.value?.filter((user) => user.username.toLowerCase().includes(query.value.toLowerCase())));
const selectedUser = ref<NonNullable<(typeof users.value)>[number]>();

const selectedPermission = ref<typeof insertablePermissionHierarchy[number]>('edit');
async function addEditPermission() {
  if (!selectedUser.value) return;
  const repsonse = await backendConnection.client.user.createPermission.mutate({
    userId: selectedUser.value.userId,
    targetId: props.vrSpaceId,
    targetType: 'vrSpace',
    permissionLevel: selectedPermission.value,
  });
}
async function removeEditPermission(userId: UserId) {
  const response = await backendConnection.client.user.removePermission.mutate({
    targetId: props.vrSpaceId,
    targetType: 'vrSpace',
    userId,
  })
}

const allowedVrSpaces = ref<RouterOutputs['vr']['listAvailableVrSpaces']>();
const portalTargetVrSpace = ref<NonNullable<typeof allowedVrSpaces.value>[number]>();
watch(portalTargetVrSpace, (newVrSpaceId) => {
  if (!newVrSpaceId) {
    setCursorMode(undefined);
  } else {
    setCursorMode('place-vrPortal');
  }
});
onMounted(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);

  const usersResponse = await backendConnection.client.user.getAllUsers.query();
  users.value = usersResponse.filter(u => u.userId !== clientStore.clientState?.userId);
  const sp = vrSpaceStore.currentVrSpace?.dbData.spawnPosition as THREE.Vector3Tuple;
  if (sp) uncommitedSpawnPosition.value = sp;

  allowedVrSpaces.value = await backendConnection.client.vr.listAvailableVrSpaces.query();
});

const skyColor = ref();

// async function onRaycastHover(point: Point) {
//   hoverPosition.value = point;
//   switch (currentRaycastReason.value) {
//     case 'spawnPosition':
//       uncommitedSpawnPosition.value = point;
//       break;
//     // case 'selfPlacement':
//     //   break;
//   }
//   console.log('raycast intersection:', point);
// }

function cancelRaycasting() {
  // isRaycastingActive.value = false;
  setCursorMode(undefined);
  portalTargetVrSpace.value = undefined;
}

let abortController: AbortController | undefined = undefined;
function uploadScreenshot(canvas: ScreenshotPayload) {
  console.log('screenshot');
  if (abortController) abortController.abort();
  // const c = document.querySelector('#canvas-container');
  // c.appendChild(canvas);
  abortController = new AbortController();
  canvas.toBlob(async (canvasBlob) => {
    if (!vrSpaceStore.writableVrSpaceDbData) return;
    if (!canvasBlob) return;
    const data = new FormData();
    data.append('file', canvasBlob, `${vrSpaceStore.currentVrSpace?.dbData.name}-screenshot.png`);
    data.set('assetType', 'image');
    data.set('showInUserLibrary', 'false');
    const response = await uploadFileData({
      data,
      authToken: authStore.tokenOrThrow(),
      abortController: abortController,
    });
    if ('error' in response) {
      console.error('failed to upload screenshot', response);
      return;
    }
    vrSpaceStore.writableVrSpaceDbData.panoramicPreviewAssetId = response.assetId;
  });
}

// async function setEntrancePosition(point: Point) {
//   const modelId = vrSpaceStore.currentVrSpace.;
//   if (!modelId) return;
//   await connectionStore.client.vr.update3DModel.mutate({
//     vr3DModelId: modelId,
//     data: {
//       entrancePosition: point,
//     },
//   });
// }

// async function onEntranceRotationCommited() {
//   console.log('rotation changed', entranceRotation.value);
//   const modelId = vrSpaceStore.currentVrSpace.virtualSpace3DModelId;
//   if (!modelId) return;
//   await connectionStore.client.vr.update3DModel.mutate({
//     vr3DModelId: modelId,
//     reason: 'entrance rotation updated',
//     data: {
//       entranceRotation: entranceRotation.value,
//     },
//   });
// }

// async function onSpawnRadiusCommited() {
//   console.log('spawn radius changed', spawnRadius.value);
//   const modelId = vrSpaceStore.currentVrSpace.virtualSpace3DModelId;
//   if (!modelId) return;
//   await connectionStore.client.vr.update3DModel.mutate({
//     vr3DModelId: modelId,
//     reason: 'spawn radius updated',
//     data: {
//       spawnRadius: spawnRadius.value,
//     },
//   });
// }

// const openVirtualSpace = async () => {

//   await connectionStore.client.vr.enterVrSpace.mutate();
//   const routeData = router.resolve({ name: 'adminLobby' });
//   window.open(routeData.href, '_blank');
// };

// const createVirtualSpace = async () => {
//   await connectionStore.client.vr.createVrSpace.mutate();
// };

// const updateScale = async () => {
//   if(venueStore.currentVenue?.vrSpace?.virtualSpace3DModel?.modelId){
//     await connectionStore.client.vr.update3DModel.mutate({
//       modelId: venueStore.currentVenue.vrSpace.virtualSpace3DModel.modelId,
//       scale: modelScale.value,
//     });
//   }
// };

</script>

<style scoped>
.activeRaycast {
  animation: framesActiveRaycast 1s ease-in-out infinite alternate;
}


@keyframes framesActiveRaycast {
  from {
    background-color: darkblue;
  }

  to {
    background-color: dodgerblue;
  }
}
</style>
