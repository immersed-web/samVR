<template>
  <div class="flex gap-8 items-center">
    <h1 class=" text-3xl font-bold">
      Redigera {{ vrSpaceStore.writableVrSpaceDbData?.name }}
    </h1>
    <RouterLink :to="{ name: 'vrSpace', params: { vrSpaceId: props.vrSpaceId } }">
      <button class="btn btn-primary btn-sm">besök <span class="material-icons">open_in_new</span></button>
    </RouterLink>
  </div>
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
        <div class="collapse-content flex flex-col items-stretch gap-3">
          <div class="">
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
        <div class="collapse-content flex flex-col items-stretch gap-3">
          <div class="">
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
          <div class="">
            <div class="divider">
              Delning
            </div>
            <p class="text-sm mb-2 text-gray-600">
              Välj de användare som ska ha tillgång till scenen, samt på vilken nivå de ska ha tillgång.
            </p>
            <span class="label-text font-semibold whitespace-nowrap">
              Dela med en ny person
            </span>
            <div class="flex gap-2 justify-between items-center z-10 flex-wrap">
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
        <div class="collapse-content flex flex-col items-stretch gap-3">
          <template v-if="vrSpaceStore.currentVrSpace">
            <div class="">
              <div class="divider">
                Himlens färg
              </div>
              <div class="flex gap-2 items-center">
                <div class="rounded-full outline outline-2 overflow-clip">
                  <input class="size-10 border-none block cursor-pointer -m-2" type="color"
                    v-model="vrSpaceStore.writableVrSpaceDbData.skyColor">
                </div>
                <span class="label-text text-gray-600">
                  Välj den färg som himlen ska ha i VR-scenen.
                </span>
              </div>
            </div>
            <div class="">
              <div class="divider">
                3D-modell för miljön
              </div>
              <p class="text-sm mb-2 text-gray-600">
                Ladda upp en 3D-modell för VR-scenens miljö. Detta är den modell som omsluter besökaren, t.ex. ett
                rum eller en park.
              </p>
              <pre
                class="whitespace-normal">{{ vrSpaceStore.currentVrSpace.dbData.worldModelAsset?.originalFileName }}</pre>
              <AssetUpload @uploaded="onModelUploaded" :accepted-asset-types="['model']" name="miljömodell"
                :show-in-user-library="false" :uploaded-asset-data="vrSpaceStore.currentVrSpace.dbData.worldModelAsset"
                @asset-deleted="vrSpaceStore.reloadVrSpaceFromDB" />
            </div>

            <template v-if="vrSpaceStore.currentVrSpace.dbData.worldModelAsset">
              <div class="">
                <div class="divider">
                  3D-modell för gåbara ytor (navmesh)
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Ladda upp en 3D-modell för miljöns navmesh. Modellen anger var besökarna kan röra sig fritt samt
                  vilka ytor som inte går att beträda. Ifall en navmesh-modell inte laddas upp så försöker programmet
                  att beräkna detta automatiskt, vilket kan ge upphov till oväntade fel.
                </p>
                <pre
                  class="whitespace-normal">{{ vrSpaceStore.currentVrSpace.dbData.navMeshAsset?.originalFileName }}</pre>
                <AssetUpload @uploaded="onNavmeshUploaded" accepted-asset-types="navmesh" name="navmesh"
                  :show-in-user-library="false" :uploaded-asset-data="vrSpaceStore.currentVrSpace.dbData.navMeshAsset"
                  @asset-deleted="vrSpaceStore.reloadVrSpaceFromDB" />
              </div>
              <div class="">
                <div class="divider">
                  Storlek
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Justera storleken på 3D-modellen.
                </p>
                <div class="flex gap-4 items-center w-full">
                  <span class="label-text font-bold badge badge-outline badge-lg">
                    {{ vrSpaceStore.writableVrSpaceDbData.worldModelScale.toFixed(5) }}
                  </span>
                  <input class="range grow" type="range" min="0.1" max="5" step="0.00001"
                    v-model.number="vrSpaceStore.writableVrSpaceDbData.worldModelScale">
                  <button @click="vrSpaceStore.writableVrSpaceDbData.worldModelScale = 1"
                    class="btn btn-xs btn-circle btn-outline material-icons">replay</button>
                </div>
              </div>

              <!-- Startplats -->
              <div class="">
                <div class="divider">
                  Startplats för besökare
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Välj den plats där besökare startar då de öppnar VR-scenen.
                  Klicka på knappen nedan och sedan i 3D-modellen för att placera startplatsen.
                  Du kan ändra storlek på startplatsen för att slumpa startpositionen inom den gula cirkeln.
                </p>
                <div class="flex gap-4 g items-end justify-stretch">
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
                  <label class="flex grow flex-col gap-1">
                    <span class="label-text font-semibold whitespace-nowrap">
                      Startplatsens storlek
                    </span>
                    <input type="range" min="0.5" max="8" step="0.1"
                      v-model.number="vrSpaceStore.writableVrSpaceDbData.spawnRadius" class="range">
                  </label>
                </div>
              </div>

              <!-- Portaler -->
              <div class="">
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
                  <AutoComplete v-if="allowedPortalTargets?.length" v-model="portalTargetVrSpace"
                    :options="allowedPortalTargets" display-key="name" id-key="vrSpaceId" />
                  <!-- <select class="select select-sm select-bordered" v-model="portalTargetVrSpace"
                      @change="isRaycastingActive = true">
                      <option v-for="vrSpace in allowedVrSpaces" :key="vrSpace.vrSpaceId" :value="vrSpace.vrSpaceId">
                        {{
                        vrSpace.name }}
                      </option>
                    </select> -->
                </div>
              </div>

            </template>
          </template>
        </div>
      </div>
      <div class="collapse collapse-arrow join-item border-base-300 border">
        <input type="checkbox" name="settings-accordion" true-value="assetLibrary" false-value=""
          v-model="activeAccordion">
        <div class="collapse-title bg-gray-100">
          Mediabibliotek
        </div>
        <div class="collapse-content flex flex-col items-stretch gap-3">
          <!-- Placera objekt -->
          <div>

            <div class="divider">
              Ladda upp objekt till ditt bibliotek
            </div>
            <AssetUpload @uploaded="onAssetUploaded" :accepted-asset-types="['document', 'image', 'video', 'model']"
              name="object" :show-in-user-library="true" />
          </div>
          <!-- <p class="text-sm label">
            Placera objekt såsom bilder och PDF i 3D-modellen.
          </p> -->
          <div>

            <div class="divider">
              Placera object i scenen
            </div>
            <AssetLibrary :assets="libraryAssets" @asset-picked="onAssetPicked" />
          </div>
        </div>
      </div>
    </div>

    <!-- COLUMN -->
    <div>
      <div class="sticky top-2">
        <VrSpacePreview class="border rounded-md overflow-hidden" ref="vrComponentTag"
          :model-url="vrSpaceStore.worldModelUrl" :navmesh-url="vrSpaceStore.navMeshUrl"
          :raycastSelector="currentRaycastSelectorString"
          :auto-rotate="currentCursorMode === undefined && selectedPlacedObject === undefined">
          <a-entity v-if="true" id="placed-objects">
            <a-entity v-for="placedObject in placedObjectsNotBeingEdited"
              :key="`${placedObject.placedObjectId}_${placedObject.updatedAt}`"
              :rotation="arrToCoordString(quaternionTupleToAframeRotation(placedObject.orientation ?? [0, 0, 0, 1]))"
              :position="arrToCoordString(placedObject.position)">
              <VrSpacePortal v-if="placedObject.type === 'vrPortal'" @click.stop="selectedPlacedObject = placedObject"
                :vr-portal="placedObject.vrPortal" class="selectable-object" :label="placedObject.vrPortal?.name" />
              <PlacedAsset v-else-if="placedObject.type === 'asset' && placedObject.asset"
                @click="selectedPlacedObject = placedObject" class="editable-object"
                :scale="placedObject.scale ? arrToCoordString(placedObject.scale) : ''" :asset="placedObject.asset" />
            </a-entity>
          </a-entity>
          <a-entity v-if="transformedSelectedObject">
            <VrSpacePortal :key="`selected-${transformedSelectedObject.placedObjectId}`"
              v-if="transformedSelectedObject.type === 'vrPortal'"
              :position="transformedSelectedObject.position?.join(' ')" :vr-portal="transformedSelectedObject.vrPortal"
              :label="'markerad'" />
            <PlacedAsset v-else-if="transformedSelectedObject.type === 'asset' && transformedSelectedObject.asset"
              :key="`transformed-${transformedSelectedObject.placedObjectId}`" box-helper
              :rotation="arrToCoordString(quaternionTupleToAframeRotation(transformedSelectedObject.orientation ?? [0, 0, 0, 1]))"
              :position="arrToCoordString(transformedSelectedObject.position)" class="selectable-object"
              :scale="transformedSelectedObject.scale ? arrToCoordString(transformedSelectedObject.scale) : ''"
              :asset="transformedSelectedObject.asset" />
          </a-entity>

          <a-entity ref="spawnPosTag" v-if="spawnPosString" :position="spawnPosString">
            <a-circle color="yellow" transparent="true" rotation="-90 0 0" position="0 0.05 0"
              :opacity="currentCursorMode === 'place-spawnposition' ? 0.2 : 0.5"
              :radius="vrSpaceStore.writableVrSpaceDbData.spawnRadius" />
            <a-icosahedron v-if="vrSpaceStore.panoramicPreviewUrl" detail="5" scale="-0.5 -0.5 -0.5"
              :position="`0 ${defaultHeightOverGround} 0`"
              :opacity="currentCursorMode === 'place-spawnposition' ? 0.5 : 1.0"
              :material="`shader: vr-portal; warpParams: 3 0.9; src: url(${vrSpaceStore.panoramicPreviewUrl}); side: back;`" />
          </a-entity>
          <a-entity id="teleport-target-aframe-cursor" ref="cursorEntity">

            <a-entity :visible="currentCursorMode !== undefined" axes-helper>
              <!-- <a-ring color="yellow" radius-inner="0.1" radius-outer="0.2"
                material="shader: flat; side: double;" rotation="-90 0 0">
                <a-cone color="green" position="0 0 0" scale="0.1 0.2 0.1" rotation="0 0 0" />
              </a-ring> -->
              <!-- <a-box material="shader: flat; side: double;" scale="0.2 0.2 0.2" color="magenta" rotation="90 0 0">
                <a-cone color="green" position="0 1 0" scale="0.5 1 0.5" rotation="0 0 0" />
              </a-box> -->
            </a-entity>
            <a-entity position="0 0 0.02" v-if="currentlyMovedObject">
              <!-- <VrSpacePortal :key="`selected-${transformedSelectedObject.placedObjectId}`"
                v-if="transformedSelectedObject.type === 'vrPortal'" show-box-helper
                :position="transformedSelectedObject.position?.join(' ')"
                :vr-portal="transformedSelectedObject.vrPortal" :label="'markerad'" /> -->
              <PlacedAsset v-if="isAsset(currentlyMovedObject)" :key="currentlyMovedObject.assetId"
                :asset="currentlyMovedObject" />
              <template v-else>
                <PlacedAsset v-if="currentlyMovedObject.type === 'asset' && currentlyMovedObject.asset"
                  :asset="currentlyMovedObject.asset"
                  :scale="currentlyMovedObject.scale ? arrToCoordString(currentlyMovedObject.scale) : ''" />
              </template>
            </a-entity>

            <!-- <a-entity ref="debugConeTag" position="0.3 0 0" axes-helper>
              <a-troika-text look-at-camera value="normal" font-size="0.1" position="0 0.2 0" />
              <a-cone color="orange" position="-0.2 0 0" scale="0.1 0.2 0.1" rotation="90 0 0" />
            </a-entity>
            <a-entity ref="debugConeTag2" position="-0.3 0 0" axes-helper>
              <a-troika-text look-at-camera value="facenormal" font-size="0.1" position="0 0.2 0" />
              <a-cone color="pink" position="0.2 0 0" scale="0.1 0.2 0.1" rotation="90 0 0" />
            </a-entity> -->
          </a-entity>

          <!-- <a-box material="shader: flat; side: double;" scale="0.2 0.2 0.2" color="magenta" rotation="0 0 0"
            position="5 0.7 3">
            <a-cone color="green" position="0 1 0" scale="0.5 1 0.5" rotation="0 0 0" />
          </a-box> -->
          <!-- <PlacablesTeleport /> -->
          <!-- <a-entity :position="hoverPosString" :visible="hoverPosString !== undefined">
              <a-ring color="yellow" radius-inner="0.1" radius-outer="0.2" material="shader: flat;"
                rotation="-90 0 0" />
            </a-entity> -->
        </VrSpacePreview>
        <button v-if="currentCursorMode || selectedPlacedObject" class="btn btn-sm btn-circle"
          @click="cancelCursorStuff">
          <span class="material-icons">close</span>
        </button>
        <button @click="setCursorMode('laser')" class="btn btn-sm">hover</button>

        <!-- <pre class="text-xs whitespace-normal">tsPO position: {{ transformedSelectedObject?.position }}</pre> -->
        <!-- <pre class="text-xs whitespace-normal">currentCursorMode: {{ currentCursorMode }}</pre> -->
        <!-- <pre class="text-xs whitespace-normal">currentRaycastSelectorString: {{ currentRaycastSelectorString }}</pre> -->
        <!-- <pre class="text-xs whitespace-normal">objectRotation: {{ placedObjectRotation }}</pre> -->
        <!-- <pre class="text-xs">currentCursorTransform: {{ currentCursorTransform }}</pre> -->
        <!-- <pre v-if="currentCursorTransform"
          class="text-xs">currentCursorTransform aframe rotation: {{ quaternionTupleToAframeRotation(currentCursorTransform.rotation) }}</pre> -->
        <!-- <pre class="text-xs">nrOfPlacedObjects: {{ placedObjectsNotBeingEdited.length }}</pre>
        <pre class="text-xs">currentlyMovedObject: {{ currentlyMovedObject }}</pre> -->
        <!-- <pre class="text-xs">composable scale ref: {{ placedObjectScale }}</pre> -->
        <!-- <pre
          class="text-xs">qToAframe(sPo): {{ quaternionTupleToAframeRotation(selectedPlacedObject?.orientation ?? [0, 0, 0, 1]) }}</pre> -->
        <!-- <pre class="text-xs">composable rotation ref: {{ placedObjectRotation }}</pre>
        <pre class="text-xs">sPO orientation: {{ selectedPlacedObject?.orientation }}</pre>
        <pre class="text-xs">tsPO orientation: {{ transformedSelectedObject?.orientation }}</pre> -->
        <!-- 
        <pre>{{ selectedPlacedObject?.position }}</pre>
        <pre>{{ vrSpaceStore.currentVrSpace?.dbData.placedObjects.find(p => p.placedObjectId === selectedPlacedObject?.placedObjectId)?.position }}</pre> -->
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
import { ref, watch, onMounted, computed, type ComponentInstance, onBeforeUnmount } from 'vue';
// import { throttle } from 'lodash-es';
import { insertablePermissionHierarchy, type Asset, type VrSpaceId, defaultHeightOverGround, type UserId, type Json } from 'schemas';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import type { RouterOutputs } from '@/modules/trpcClient';
// import UserBanner from '@/components/UserBanner.vue';
import AssetLibrary from '@/components/lobby/AssetLibrary.vue';
import { uploadFileData } from '@/modules/utils';
import VrSpacePortal from '@/components/entities/VrSpacePortal.vue';
import AutoComplete from '@/components/AutoComplete.vue';
import { useCurrentCursorIntersection, useSelectedPlacedObject, useCurrentlyMovedObject, isAsset } from '@/composables/vrSpaceComposables';
import { THREE, type Entity } from 'aframe';
import { arrToCoordString, intersectionToTransform, quaternionTupleToAframeRotation } from '@/modules/3DUtils';
import { useArrayFilter, watchDebounced } from '@vueuse/core';
import PlacedAsset from '@/components/lobby/PlacedAsset.vue';
import { RouterLink } from 'vue-router';

// TODO: refine/find alternative way to get these types so we get intellisense for the emit key
type ExtractEmitData<T extends string, emitUnion extends (...args: any[]) => void> = T extends Parameters<emitUnion>[0] ? Parameters<emitUnion>[1] : never
type ScreenshotPayload = ExtractEmitData<'screenshot', ComponentInstance<typeof VrSpacePreview>['$emit']>

const { selectedPlacedObject, placedObjectRotation, placedObjectScale, transformedSelectedObject, onTransformUpdate } = useSelectedPlacedObject();
const { currentlyMovedObject } = useCurrentlyMovedObject();

onTransformUpdate(spo => {
  const transformedPO = spo;
  console.log('selected object transform hook triggered');
  // const objectId = transformedPO.asset?.assetId??transformedPO.vrPortal?.vrSpaceId??transformedPO.streamPortal?.streamId;
  // const pos = transformedPO.orientation
  const { objectSettings, ...data } = transformedPO;
  vrSpaceStore.upsertPlacedObject({
    vrSpaceId: props.vrSpaceId,
    ...data,
    objectSettings: objectSettings as Json
  });
})


const { setCursorMode, currentCursorMode, currentRaycastSelectorString, setCursorEntityRef, onCursorClick, currentCursorIntersection, currentCursorTransform, triggerCursorClick } = useCurrentCursorIntersection();
setCursorMode('select-objects');
watch(currentCursorIntersection, (intersection) => {
  if (currentCursorMode.value === 'place-spawnposition') {
    uncommitedSpawnPosition.value = intersection?.intersection.point?.toArray() ?? [0, 0, 0];
  }
});

function cancelCursorStuff() {
  setCursorMode('select-objects');
  selectedPlacedObject.value = undefined;
  currentlyMovedObject.value = undefined;
}

const backendConnection = useConnectionStore();
const vrSpaceStore = useVrSpaceStore();
const authStore = useAuthStore();
const clientStore = useClientStore();
const cursorEntity = ref<Entity>();
setCursorEntityRef(cursorEntity);

watch(() => vrSpaceStore.currentVrSpace?.dbData.placedObjects, () => {
  console.log('placedObjectsNotBeingEdited watcher triggered');
})

const placedObjectsNotBeingEdited = useArrayFilter(() => {
  console.log('placedObjectsNotBeingEdited recalculated');
  return vrSpaceStore.currentVrSpace?.dbData.placedObjects ?? []
}, po => {
  const isSelected = selectedPlacedObject.value?.placedObjectId === po.placedObjectId;
  let isCurrentlyMoved = false;
  if (!isAsset(currentlyMovedObject.value)) {
    isCurrentlyMoved = currentlyMovedObject.value?.placedObjectId === po.placedObjectId;
  }
  return !isSelected && !isCurrentlyMoved
})

const debugConeTag = ref<Entity>();
const debugConeTag2 = ref<Entity>();
const utilMatrix = new THREE.Matrix4();
const utilVector = new THREE.Vector3();
watch(currentCursorIntersection, (intersection) => {
  if (!intersection || !debugConeTag.value || !debugConeTag2.value) return;
  let normal = intersection.worldSpaceNormal;
  let faceNormal = intersection.intersection.face?.normal
  if (normal) {
    utilVector.set(...normal);
    utilVector.multiplyScalar(2000);
    debugConeTag.value?.object3D.lookAt(utilVector);
    debugConeTag.value.setAttribute('visible', true);
  } else {
    debugConeTag.value.setAttribute('visible', false);
  }
  if (faceNormal) {
    faceNormal = utilVector.copy(faceNormal);
    utilVector.multiplyScalar(2000);
    debugConeTag2.value?.object3D.lookAt(utilVector);
    debugConeTag2.value.setAttribute('visible', 'pink');
  } else {
    debugConeTag2.value.setAttribute('visible', false);
  }

})


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
  setCursorMode('select-objects');
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
      case 'place-asset':
        await placeMovedObject();
        cancelCursorStuff();
    }
  }
});

async function placeMovedObject() {
  console.log('placeMovedObject triggered');
  if (!currentlyMovedObject.value || !currentCursorIntersection.value) {
    console.warn('no currentlyMovedObject or currentCursorTransform provided to placeMovedObject');
    return;
  }
  const transform = currentCursorTransform.value
  if (!transform) {
    console.error('intersectionToTransform gave undefined');
    return;
  }
  const { position, rotation } = transform;

  if (isAsset(currentlyMovedObject.value)) {
    console.log('placed an asset. Need to create a placedObject');
    await vrSpaceStore.upsertPlacedObject({
      vrSpaceId: props.vrSpaceId,
      type: 'asset',
      objectId: currentlyMovedObject.value.assetId,
      position,
      orientation: rotation
    }, 'placing an asset')
    currentlyMovedObject.value = undefined;
    return;
  } else {
    console.log('placed an already placedObject, should update the DB');
    await vrSpaceStore.upsertPlacedObject({
      vrSpaceId: props.vrSpaceId,
      placedObjectId: currentlyMovedObject.value.placedObjectId,
      position,
      orientation: rotation,
      type: currentlyMovedObject.value.type,
    })
  }
}

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
  currentlyMovedObject.value = asset
  setCursorMode('place-asset');
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
const allowedPortalTargets = useArrayFilter(allowedVrSpaces, vrSpace => vrSpace.vrSpaceId !== vrSpaceStore.currentVrSpace?.dbData.vrSpaceId)
const portalTargetVrSpace = ref<NonNullable<typeof allowedVrSpaces.value>[number]>();
watch(portalTargetVrSpace, (newVrSpaceId) => {
  if (!newVrSpaceId) {
    // setCursorMode(undefined);
    cancelCursorStuff();
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
onBeforeUnmount(async () => {
  await vrSpaceStore.leaveVrSpace();
})

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
