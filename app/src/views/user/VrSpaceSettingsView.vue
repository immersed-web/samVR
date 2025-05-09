<template>
  <div class="w-full max-w-[125rem] px-4 py-8 mx-auto">
    <div class="flex gap-8 mb-6 items-center">
      <h1 class=" text-3xl font-bold">
        Redigera {{ vrSpaceStore.writableVrSpaceDbData?.name }}
      </h1>
      <RouterLink :to="{ name: 'vrSpace', params: { vrSpaceId: props.vrSpaceId } }">
        <button class="btn btn-primary btn-sm">Besök <span class="material-icons">open_in_new</span></button>
      </RouterLink>
    </div>
    <div class="grid h-[40vh] place-content-center"
      v-if="!vrSpaceStore.writableVrSpaceDbData || !vrSpaceStore.currentVrSpace">
      <span class="loading loading-infinity loading-lg"></span>Laddar
    </div>
    <div v-else class="grid grid-cols-[clamp(17rem,45%,47rem)_1fr] gap-2">
      <TabsComponent class="max-w-4xl" :tabs="tabs" breakpoint-adjustment.number="1.03">
        <template v-if="hasAdminRights">

          <TabPanel>
            <div class="space-y-4">
              <div class="form-control">
                <div class="font-semibold">Scenens namn</div>
                <input class="input input-bordered input-sm" v-model="vrSpaceStore.writableVrSpaceDbData.name">
              </div>
              <div class="form-control">
                <div class="font-semibold">Beskrivning</div>
                <textarea rows=5 class="textarea textarea-bordered " placeholder="beskriv din vr-miljö"
                  v-model="vrSpaceStore.writableVrSpaceDbData.description"></textarea>
              </div>
              <div class="flex items-center gap-4 justify-end">
                <span class="text-red-600 text-sm">
                  Varning. Detta tar bort vr-miljön permanent!
                </span>
                <button v-if="!isRevealed" @click.stop="triggerDeleteDialog" class="btn btn-error btn-sm">Radera denna
                  VR-miljö</button>
                <template v-else>
                  <button @click="confirm" class="btn btn-error btn-sm">Klicka en gång till för att verifiera</button>
                  <button @click="cancel" class="btn btn-sm">Avbryt</button>
                </template>

              </div>
            </div>
          </TabPanel>
          <TabPanel>
            <div class="space-y-4">
              <div class="divider mt-0">
                Publik eller privat?
              </div>
              <p class="text-sm text-gray-600">
                Välj ifall VR-scenen ska vara publikt tillgänglig, öppen för vem som helst att besöka. Eller om scenen
                är privat för dig och de
                du har valt att dela den med.
              </p>
              <div class="flex gap-4 items-center">
                <span class="label-text font-semibold leading-none">
                  Delning/tillgänglighet:
                </span>
                <div class="join">
                  <input type="radio" v-model="vrSpaceStore.writableVrSpaceDbData.visibility" value="private"
                    name="visibility" class="join-item btn btn-sm" aria-label="privat" />
                  <input type="radio" v-model="vrSpaceStore.writableVrSpaceDbData.visibility" value="unlisted"
                    name="visibility" class="join-item btn btn-sm" aria-label="olistad" />
                  <input type="radio" v-model="vrSpaceStore.writableVrSpaceDbData.visibility" value="public"
                    name="visibility" class="join-item btn btn-sm" aria-label="öppen" />
                </div>

                <!-- <input type="checkbox" class="toggle toggle-success" true-value="public" false-value="private"
                  v-model="vrSpaceStore.writableVrSpaceDbData.visibility"> -->
              </div>
              <div class="divider">
                Delning
              </div>
              <p class="text-sm text-gray-600">
                Välj de användare som ska ha tillgång till scenen, samt på vilken nivå de ska ha tillgång.
              </p>

              <div class="form-control">
                <span class="font-semibold">
                  Dela med en ny person
                </span>
                <div class="flex gap-2 justify-between items-center z-10 flex-wrap">
                  <AutoComplete v-if="users?.length" class="grow" placeholder="sök efter användare..."
                    v-model="selectedUser" display-key="username" id-key="userId" :options="users" />
                  <select v-model="selectedPermission" class="select select-bordered select-sm">
                    <option :value="permissionLevel" v-for="permissionLevel in insertablePermissionHierarchy"
                      :key="permissionLevel">
                      {{ translatePermissionLevelVerb(permissionLevel) }}
                    </option>
                  </select>
                  <button :disabled="!selectedUser" @click="addEditPermission" class="btn btn-primary btn-sm">
                    Lägg till
                  </button>
                </div>
              </div>
              <!-- <p>{{ selectedUser }}</p> -->
              <!-- <p class="overflow-hidden">{{ users }}</p> -->

              <div class="form-control">
                <span class="font-semibold">
                  Personer med tillgång till VR-scenen
                </span>
                <div class="grid grid-cols-[0.5fr_1fr_0fr] gap-6 w-fit">

                  <template v-for="userPermission in vrSpaceStore.currentVrSpace?.dbData.allowedUsers"
                    :key="userPermission.user.userId">
                    <span>{{ userPermission.user.username }}</span>
                    <span> {{ translatePermissionLevelAdjective(userPermission.permissionLevel) }}</span>
                    <button class="btn btn-circle btn-xs material-icons"
                      @click="removeEditPermission(userPermission.user.userId)">clear</button>
                  </template>
                </div>
              </div>
            </div>
          </TabPanel>
          <TabPanel>
            <template v-if="vrSpaceStore.currentVrSpace">
              <div class="space-y-4">
                <div class="divider mt-0">
                  3D-modell för miljön
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Ladda upp en 3D-modell för VR-scenens miljö. Detta är den modell som omsluter besökaren, t.ex. ett
                  rum eller en park.
                </p>
                <pre
                  class="whitespace-normal">{{ vrSpaceStore.currentVrSpace.dbData.worldModelAsset?.originalFileName }}</pre>
                <AssetUpload @uploaded="onModelUploaded" :accepted-asset-types="['model']" name="miljömodell"
                  :show-in-user-library="false"
                  :uploaded-asset-data="vrSpaceStore.currentVrSpace.dbData.worldModelAsset"
                  @asset-deleted="vrSpaceStore.reloadVrSpaceFromDB" />
              </div>

              <template v-if="vrSpaceStore.currentVrSpace.dbData.worldModelAsset">
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
                <div class="divider">
                  Storlek
                </div>
                <p class="text-sm mb-2 text-gray-600">
                  Justera storleken på 3D-modellen.
                </p>
                <div class="flex gap-4 items-center w-full">
                  <input v-model.number="vrSpaceStore.writableVrSpaceDbData.worldModelScale"
                    class="label-text font-bold badge badge-outline badge-lg w-24">
                  <!-- {{ vrSpaceStore.writableVrSpaceDbData.worldModelScale.toFixed(5) }}
                </span> -->
                  <input class="range grow" type="range" min="0.1" max="5" step="0.00001"
                    v-model.number="vrSpaceStore.writableVrSpaceDbData.worldModelScale">
                  <button @click="vrSpaceStore.writableVrSpaceDbData.worldModelScale = 1"
                    class="btn btn-xs btn-circle btn-outline material-icons">replay</button>
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

              </template>
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

            </template>
          </TabPanel>
        </template>
        <TabPanel>
          <!-- Placera objekt -->
          <div class="space-y-4">

            <div class="divider mt-0">
              Ladda upp objekt till ditt bibliotek
            </div>
            <AssetUpload @uploaded="clientStore.reloadDbData"
              :accepted-asset-types="['document', 'image', 'video', 'model']" name="object"
              :show-in-user-library="true" />
            <div class="divider">
              Placera objekt i scenen
            </div>
            <AssetLibrary @asset-deleted="vrSpaceStore.reloadVrSpaceFromDB" :assets="libraryAssets"
              @asset-picked="onAssetPicked" />
          </div>
        </TabPanel>
        <TabPanel>
          <div class="space-y-4">
            <div class="divider mt-0">
              Portaler till andra VR-scener
            </div>
            <p class="text-sm text-gray-600">
              Skapa portaler som låter besökarna förflytta sig till andra VR-scener. Välj en scen att förflytta
              sig till
              och klicka sedan i 3D-modellen för att placera portalen.
            </p>
            <div class="form-control">
              <div class="font-semibold">Placera ut ny portal</div>
              <AutoComplete v-if="allowedPortalTargets?.length" placeholder="Sök efter vr-miljö..."
                v-model="portalTargetVrSpace" :options="allowedPortalTargets" display-key="name" id-key="vrSpaceId" />
            </div>
            <div class="divider">Utplacerade objekt</div>
            <PlacedObjectsList @removePlacedObject="onRemoveObjectFromScene"
              @placed-object-picked="onPlacedObjectPicked" v-if="vrSpaceStore.currentVrSpace?.dbData.placedObjects"
              :placed-objects="vrSpaceStore.currentVrSpace?.dbData.placedObjects" />
          </div>
        </TabPanel>
      </TabsComponent>

      <div>
        <div class="sticky top-2">
          <WaitForAframe>
            <VrSpacePreview class="border rounded-md overflow-hidden" ref="vrComponentTag"
              :model-url="vrSpaceStore.worldModelUrl" :navmesh-url="vrSpaceStore.navMeshUrl"
              :raycastSelector="currentRaycastSelectorString"
              :auto-rotate="currentCursorMode === 'select-objects' && selectedPlacedObject === undefined">
              <a-entity v-if="true" id="placed-objects">
                <a-entity v-for="placedObject in placedObjectsNotBeingEdited"
                  :key="`${placedObject.placedObjectId}_${placedObject.updatedAt}`"
                  :rotation="arrToCoordString(quaternionTupleToAframeRotation(placedObject.orientation ?? [0, 0, 0, 1]))"
                  :position="arrToCoordString(placedObject.position)">
                  <VrSpacePortal v-if="placedObject.type === 'vrPortal'"
                    @click.stop="selectedPlacedObject = placedObject" :vr-portal="placedObject.vrPortal"
                    class="selectable-object" :label="placedObject.vrPortal?.name" />
                  <PlacedAsset v-else-if="placedObject.type === 'asset' && placedObject.asset"
                    @click="selectedPlacedObject = placedObject" class="editable-object"
                    :scale="placedObject.scale ? arrToCoordString(placedObject.scale) : ''"
                    :asset="placedObject.asset" />
                </a-entity>
              </a-entity>
              <a-entity v-if="transformedSelectedObject">
                <VrSpacePortal :key="`selected-${transformedSelectedObject.placedObjectId}`"
                  v-if="transformedSelectedObject.type === 'vrPortal'"
                  :position="transformedSelectedObject.position?.join(' ')"
                  :vr-portal="transformedSelectedObject.vrPortal" :label="'markerad'" />
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

                <a-entity :visible="currentCursorMode !== undefined && isCursorHovering">
                  <a-ring position="0 0 0.01" color="yellow" radius-inner="0.1" radius-outer="0.2"
                    material="shader: flat; side: double;" rotation="0 0 0">
                    <!-- <a-cone color="green" position="0 0 0" scale="0.1 0.2 0.1" rotation="0 0 0" /> -->
                  </a-ring>
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
          </WaitForAframe>
          <!-- <button @click="setCursorMode('laser')" class="btn btn-sm">hover</button> -->

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
  </div>
</template>

<script setup lang="ts">
import AssetUpload, { type AssetUploadEmitUploadedPayload } from './AssetUpload.vue';
import VrSpacePreview from '@/components/lobby/VrSpacePreview.vue';
import WaitForAframe from '@/components/WaitForAframe.vue'
import { ref, watch, onMounted, computed, type ComponentInstance, onBeforeUnmount } from 'vue';
import { insertablePermissionHierarchy, type Asset, type VrSpaceId, defaultHeightOverGround, type UserId, type Json, translatePermissionLevelAdjective, translatePermissionLevelVerb } from 'schemas';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import type { RouterOutputs } from '@/modules/trpcClient';
import AssetLibrary from '@/components/lobby/AssetLibrary.vue';
import { uploadFileData } from '@/modules/utils';
import VrSpacePortal from '@/components/entities/VrSpacePortal.vue';
import AutoComplete from '@/components/AutoComplete.vue';
import { useCurrentCursorIntersection, useSelectedPlacedObject, useCurrentlyMovedObject, isAsset } from '@/composables/vrSpaceComposables';
import { THREE, type Entity } from 'aframe';
import { arrToCoordString, quaternionTupleToAframeRotation } from '@/modules/3DUtils';
import { useArrayFilter, useConfirmDialog } from '@vueuse/core';
import PlacedAsset from '@/components/entities/PlacedAsset.vue';
import TabsComponent from '@/views/user/TabsComponent.vue';
import { TabPanel } from '@headlessui/vue';
import { RouterLink, useRouter } from 'vue-router';
import PlacedObjectsList from '@/components/lobby/PlacedObjectsList.vue';
import type { PlacedObjectWithIncludes } from 'database';
const router = useRouter();
const { isRevealed, reveal, confirm, cancel } = useConfirmDialog();

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

const hasAdminRights = computed(() => {
  const hasAdminPermission = vrSpaceStore.currentVrSpace?.dbData.allowedUsers.some(permission => {
    const userId = authStore.userId;
    return permission.user.userId === userId && permission.permissionLevel === 'admin';
  });
  const isOwner = vrSpaceStore.currentVrSpace?.dbData.ownerUserId === authStore.userId;
  const isSuperAdmin = authStore.role === 'superadmin';

  return isSuperAdmin || isOwner || hasAdminPermission;
})

const tabs = computed(() => {
  let tabList = [
    { label: 'Mediabibliotek', iconName: 'collections' },
    { label: 'Objekt', iconName: 'view_in_ar' },
  ]
  if (hasAdminRights.value) {
    tabList.unshift(
      { label: 'Info', iconName: 'info' },
      { label: 'Delning', iconName: 'manage_accounts' },
      { label: 'Scen', iconName: 'landscape' },
    )
  }
  return tabList;
})
// const tabs = [
//   { label: 'Info', iconName: 'info' },
//   { label: 'Delning', iconName: 'manage_accounts' },
//   { label: 'Scen', iconName: 'landscape' },
//   { label: 'Mediabibliotek', iconName: 'collections' },
//   { label: 'Objekt', iconName: 'view_in_ar' },
// ];

const { setCursorMode, currentCursorMode, isCursorHovering, currentRaycastSelectorString, setCursorEntityRef, onCursorClick, currentCursorIntersection, currentCursorTransform, triggerCursorClick } = useCurrentCursorIntersection();
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

async function onRemoveObjectFromScene(placedObject: PlacedObjectWithIncludes) {
  console.log('remove of placedObject triggered:', placedObject);
  await vrSpaceStore.removePlacedObject(placedObject.placedObjectId);
  if (selectedPlacedObject.value?.placedObjectId === placedObject.placedObjectId) {
    selectedPlacedObject.value = undefined;
  }
  if (currentlyMovedObject.value
    && !isAsset(currentlyMovedObject.value)
    && currentlyMovedObject.value.placedObjectId === placedObject.placedObjectId) {
    currentlyMovedObject.value = undefined;
  }
}

async function onPlacedObjectPicked(placedObject: PlacedObjectWithIncludes) {
  console.log('placedObject picked:', placedObject);
  // attachOrbitControls(scne)
  selectedPlacedObject.value = placedObject;
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

const allowedVrSpaces = ref<NonNullable<RouterOutputs['vr']['listAvailableVrSpaces']>>([]);
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

  const vrListResponse = await backendConnection.client.vr.listAvailableVrSpaces.query();
  if (vrListResponse) {
    allowedVrSpaces.value = vrListResponse;
  }
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

async function triggerDeleteDialog() {
  const { data, isCanceled } = await reveal();
  if (!isCanceled) {
    deleteThisVrSpace();
  }
}

async function deleteThisVrSpace() {
  await vrSpaceStore.deleteVrSpace();
  router.replace({ name: 'start' });
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
.input-with-label {}
.activeRaycast {
  animation: framesActiveRaycast 1s ease-in-out infinite alternate;
}

.trimmed-text {
  leading-trim: both;
  text-edge: cap alphabetic;
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
