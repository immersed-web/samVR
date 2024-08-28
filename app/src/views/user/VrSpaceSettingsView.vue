<template>
  <div class="flex flex-col gap-8">
    <h1 class=" text-3xl font-bold">
      Redigera {{ vrSpaceStore.writableVrSpaceState?.dbData.name }}
    </h1>
    <div v-if="!vrSpaceStore.writableVrSpaceState">
      loading...
    </div>
    <div v-else class="grid grid-cols-2 gap-2">
      <!-- COLUMN 1 -->
      <div class="join join-vertical w-full">
        <div class="collapse collapse-arrow join-item border-base-300 border">
          <input type="radio" name="settings-accordion" checked="checked">
          <div class="collapse-title bg-gray-100">
            Grundläggande information
          </div>
          <div class="collapse-content flex flex-col items-start space-y-4">
            <div>
              <label class="flex items-center gap-2">
                <span class="label-text">Scenens namn</span>
              </label>
              <input class="input input-bordered" v-model="vrSpaceStore.writableVrSpaceState.dbData.name">
            </div>
          </div>
        </div>
        <div class="collapse collapse-arrow join-item border-base-300 border">
          <input type="radio" name="settings-accordion">
          <div class="collapse-title bg-gray-100">
            Användare och rättigheter
          </div>
          <div class="collapse-content flex flex-col items-start space-y-4">
            <label class="max-w-sm label cursor-pointer gap-2 font-bold">
              <span class="label-text">

                Öppet för alla:
              </span>
              <input type="checkbox" class="toggle toggle-success" true-value="public" false-value="private"
                v-model="vrSpaceStore.writableVrSpaceState.dbData.visibility">
            </label>
            <div>
              <div>{{ selectedUser?.username }}</div>
              <Combobox v-model="selectedUser">
                <div class="w-72 relative">
                  <div class="join input input-bordered">
                    <ComboboxInput class="join-item" :display-value="(user) => user.username"
                      @change="query = $event.target.value" />
                    <ComboboxButton class="join-item">
                      <span class="material-icons">unfold_more</span>
                    </ComboboxButton>
                  </div>
                  <ComboboxOptions v-auto-animate class="absolute w-full menu bg-neutral-100 rounded-md">
                    <div v-if="filteredUsers?.length === 0 && query !== ''"
                      class="relative cursor-default select-none px-4 py-2 text-gray-700">
                      Inga användare hittade
                    </div>
                    <ComboboxOption v-for="user in filteredUsers" :key="user.userId" :value="user"
                      v-slot="{ active, selected }">
                      <a :class="[selected ? 'active' : '']">{{ user.username }}</a>
                    </ComboboxOption>
                  </ComboboxOptions>
                </div>
              </Combobox>
              <select v-model="selectedPermission" class="select select-bordered">
                <option :value="permissionLevel" v-for="permissionLevel in insertablePermissionHierarchy"
                  :key="permissionLevel">
                  {{ permissionLevel }}
                </option>
              </select>
              <button @click="addEditPermission" class="btn btn-primary">
                Lägg till som ägare
              </button>
              <div>
                <h3>Tillagda användare</h3>
                <div v-for="userPermission in vrSpaceStore.currentVrSpace?.dbData.allowedUsers"
                  :key="userPermission.user.userId">
                  {{ userPermission.user.username }}: {{ userPermission.permissionLevel }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="collapse collapse-arrow join-item border-base-300 border">
          <input type="radio" name="settings-accordion">
          <div class="collapse-title bg-gray-100">
            3D-modell
          </div>
          <div class="collapse-content flex flex-col items-start space-y-4">
            <template v-if="vrSpaceStore.currentVrSpace">
              <div class="flex gap-4">
                <h4>Färg på himmelen</h4>
                <input class="rounded-md border-black border-2" type="color"
                  v-model="vrSpaceStore.writableVrSpaceState.dbData.skyColor">
              </div>
              <div class="grid grid-cols-2">
                <div>
                  <h4>3D-modell för miljön</h4>
                  <pre>{{ vrSpaceStore.currentVrSpace.dbData.worldModelAsset?.originalFileName }}</pre>
                  <AssetUpload @uploaded="onModelUploaded" :accepted-asset-types="['model']" name="miljömodell"
                    :show-in-user-library="false" :remove-button="vrSpaceStore.currentVrSpace.dbData.worldModelAsset" />
                </div>
                <div v-if="vrSpaceStore.currentVrSpace?.dbData.worldModelAsset">
                  <h4>3D-modell för gåbara ytor (navmesh)</h4>
                  <pre>{{ vrSpaceStore.currentVrSpace.dbData.navMeshAsset?.originalFileName }}</pre>
                  <AssetUpload @uploaded="onNavmeshUploaded" accepted-asset-types="navmesh" name="navmesh"
                    :show-in-user-library="false" :remove-button="vrSpaceStore.currentVrSpace.dbData.navMeshAsset" />
                </div>
              </div>
              <template v-if="vrSpaceStore.currentVrSpace.dbData.worldModelAsset">
                <div class="tooltip tooltip-right"
                  data-tip="Klicka sedan i 3D-scenen för att välja var besökarna startar">
                  <input type="radio" value="spawnPosition" aria-label="Placera startplats"
                    class="btn btn-sm btn-primary" :class="{ activeRaycast: currentRaycastReason == 'spawnPosition' }"
                    v-model="currentRaycastReason">
                  <!-- <label class="flex items-center gap-2">
                    <span class="label-text">Klicka sedan i 3D-scenen för att placera startplatsen </span>
                  </label> -->
                </div>
                <label class="label gap-2">
                  <span class="label-text font-semibold whitespace-nowrap">
                    Startplats storlek
                  </span>
                  <input type="range" min="0.5" max="8" step="0.1"
                    v-model.number="vrSpaceStore.writableVrSpaceState.dbData.spawnRadius" class="range">
                </label>
              </template>
            </template>
          </div>
        </div>
      </div>

      <!-- COLUMN -->
      <div>
        <VrAFramePreview class="border rounded-md overflow-hidden" ref="vrComponentTag"
          :model-url="vrSpaceStore.worldModelUrl" :navmesh-url="vrSpaceStore.navMeshUrl"
          :raycast="currentRaycastReason !== undefined" :auto-rotate="currentRaycastReason === undefined"
          @raycast-click="onRaycastClick" @raycast-hover="onRaycastHover">
          <a-entity id="vr-portals">
            <template v-for="placedObject in vrSpaceStore.currentVrSpace?.dbData.placedObjects"
              :key="placedObject.placedObjectId">
              <VrSpacePortal v-if="placedObject.type === 'vrPortal'" :position="placedObject.position?.join(' ')"
                :label="placedObject.vrPortal?.name"
                :panoramic-preview-url="getAssetUrl(placedObject.vrPortal?.panoramicPreview?.generatedName)" />
            </template>
          </a-entity>

          <a-entity ref="spawnPosTag" v-if="spawnPosString" :position="spawnPosString">
            <a-circle color="yellow" transparent="true" opacity="0.5" rotation="-90 0 0" position="0 0.05 0"
              :radius="vrSpaceStore.currentVrSpace?.dbData.spawnRadius" />
            <a-icosahedron v-if="vrSpaceStore.panoramicPreviewUrl" detail="5" scale="-0.5 -0.5 -0.5" position="0 1.1 0"
              :material="`shader: pano-portal; warpParams: 3 0.9; src: ${vrSpaceStore.panoramicPreviewUrl}`" />
          </a-entity>
          <a-entity :position="hoverPosString" :visible="hoverPosString !== undefined">
            <a-ring color="yellow" radius-inner="0.1" radius-outer="0.2" material="shader: flat;" rotation="-90 0 0" />
          </a-entity>
        </VrAFramePreview>
        <div v-if="vrSpaceStore.currentVrSpace?.dbData.worldModelAsset" class="grid gap-2">
          <div class="alert bg-gray-100 text-xs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            Använd musen för att interagera med modellen.
            <div>
              <ul class="list-disc">
                <li>Klicka och dra: Rotera bilden</li>
                <li>Högermus och dra: Panorera längs golvytan</li>
                <li>Scrolla: Zooma</li>
              </ul>
            </div>
          </div>
          <div class="flex gap-2">
            <input type="radio" :value="undefined" class="hidden" v-model="currentRaycastReason">
            <input type="radio" value="selfPlacement" aria-label="Hoppa in världen" class="btn btn-sm btn-primary"
              v-model="currentRaycastReason">
            <button class="btn btn-sm btn-primary" @click="vrComponentTag?.exitFirstPersonView">
              hoppa ur
              världen
            </button>
            <select class="select select-sm select-bordered" v-model="portalTargetVrSpace"
              @change="currentRaycastReason = 'vrSpacePortal'">
              <option v-for="vrSpace in allowedVrSpaces" :key="vrSpace.vrSpaceId" :value="vrSpace.vrSpaceId">
                {{
                  vrSpace.name }}
              </option>
            </select>
            <button v-if="currentRaycastReason" class="btn btn-sm btn-circle" @click="cancelRaycasting">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>
        <div>
          <AssetUpload @uploaded="onAssetUploaded" :accepted-asset-types="['document', 'image', 'video']" name="object"
            :show-in-user-library="true" />
        </div>
        <div v-if="clientStore.clientState?.assets" class="grid gap-2 grid-cols-[auto_auto] max-h-64 overflow-y-auto">
          <template v-for="asset in clientStore.clientState.assets" :key="asset.assetId">
            <div>{{ asset.originalFileName }}</div>
            <button class="btn btn-sm btn-secondary">
              placera
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AssetUpload, { type EmitTypes } from './AssetUpload.vue';
import VrAFramePreview from '@/components/lobby/VrSpacePreview.vue';
import { ref, watch, onMounted, computed, type ComponentInstance, nextTick } from 'vue';
// import { throttle } from 'lodash-es';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from '@headlessui/vue';
import { insertablePermissionHierarchy, type PlacedObjectId, type VrSpaceId } from 'schemas';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import type { RouterOutputs } from '@/modules/trpcClient';
import UserBanner from '@/components/UserBanner.vue';
import { getAssetUrl, uploadFileData } from '@/modules/utils';
import VrSpacePortal from '@/components/entities/VrSpacePortal.vue';

// TODO: refine/find alternative way to get these types so we get intellisense for the emit key
type ExtractEmitData<T extends string, emitUnion extends (...args: any[]) => void> = T extends Parameters<emitUnion>[0] ? Parameters<emitUnion>[1] : never
type UploadEventPayload = ExtractEmitData<'uploaded', EmitTypes>
type ScreenshotPayload = ExtractEmitData<'screenshot', ComponentInstance<typeof VrAFramePreview>['$emit']>

// Use imports
// const router = useRouter();
const backendConnection = useConnectionStore();
const vrSpaceStore = useVrSpaceStore();
const authStore = useAuthStore();
const clientStore = useClientStore();

const vrComponentTag = ref<ComponentInstance<typeof VrAFramePreview>>();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();

function onAssetUploaded(uploadDetails: UploadEventPayload) {
  console.log(uploadDetails);
  // TODO: We should probalby have the server notify a clientstate update
  // right now we just do this hack to keep assets in local clientState in sync with db.
  // This means the server client instance is not updated with the new asset.
  // @ts-ignore
  clientStore.clientState?.assets.push(uploadDetails);
}

function onModelUploaded(uploadDetails: UploadEventPayload) {
  console.log(uploadDetails);
  if (!vrSpaceStore.writableVrSpaceState) return;
  vrSpaceStore.writableVrSpaceState.dbData.worldModelAssetId = uploadDetails.assetId;
}

function onNavmeshUploaded(uploadDetails: UploadEventPayload) {
  console.log(uploadDetails);
  if (!vrSpaceStore.writableVrSpaceState) return;
  vrSpaceStore.writableVrSpaceState.dbData.navMeshAssetId = uploadDetails.assetId;
}

const hideGizmos = ref(false);
const uncommitedSpawnPosition = ref<Point>();
const spawnPosString = computed(() => {
  if (hideGizmos.value) return undefined;
  // const posArr = vrSpaceStore.currentVrSpace?.dbData.spawnPosition;
  const posArr = uncommitedSpawnPosition.value;
  if (!posArr) return undefined;
  const v = new AFRAME.THREE.Vector3(...posArr);
  return AFRAME.utils.coordinates.stringify(v);
});

const query = ref('');
const users = ref<RouterOutputs['user']['getAllUsers']>();
const filteredUsers = computed(() => users.value?.filter((user) => user.username.toLowerCase().includes(query.value.toLowerCase())));
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

const allowedVrSpaces = ref<RouterOutputs['vr']['listAvailableVrSpaces']>();
const portalTargetVrSpace = ref<VrSpaceId>();
onMounted(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);

  users.value = await backendConnection.client.user.getAllUsers.query();
  const sp = vrSpaceStore.currentVrSpace?.dbData.spawnPosition;
  if (sp) uncommitedSpawnPosition.value = sp as Point;

  allowedVrSpaces.value = await backendConnection.client.vr.listAvailableVrSpaces.query();
});

const skyColor = ref();

type RaycastReason = 'spawnPosition' | 'selfPlacement' | 'vrSpacePortal' | undefined;
const currentRaycastReason = ref<RaycastReason>();
const hoverPosition = ref<Point>();
const hoverPosString = computed(() => {
  const raycastReason = currentRaycastReason.value;
  if (hideGizmos.value || !raycastReason) return undefined;
  const posArr = hoverPosition.value;
  if (!posArr || raycastReason === 'spawnPosition') return undefined;
  const v = new AFRAME.THREE.Vector3(...posArr);
  return AFRAME.utils.coordinates.stringify(v);
});

type Point = [number, number, number];

async function onRaycastHover(point: Point) {
  hoverPosition.value = point;
  switch (currentRaycastReason.value) {
    case 'spawnPosition':
      uncommitedSpawnPosition.value = point;
      break;
    // case 'selfPlacement':
    //   break;
  }
  console.log('raycast intersection:', point);
}

const firstPersonActive = ref(false);
async function onRaycastClick(point: Point) {
  console.log('raycast click:', point);
  const raycastReason = currentRaycastReason.value;
  currentRaycastReason.value = undefined;
  switch (raycastReason) {
    case 'spawnPosition':
      if (!vrSpaceStore.writableVrSpaceState) return;
      hideGizmos.value = true;
      vrSpaceStore.writableVrSpaceState.dbData.spawnPosition = point;
      const canvas = await vrComponentTag.value?.getPanoScreenshotFromPoint(point);
      if (!canvas) return;
      uploadScreenshot(canvas);
      hideGizmos.value = false;
      break;
    case 'selfPlacement':
      firstPersonActive.value = true;
      await nextTick();
      vrComponentTag.value?.enterFirstPersonView(point);
      break;
    case 'vrSpacePortal':
      if (!vrSpaceStore.writableVrSpaceState || !portalTargetVrSpace.value) return;
      backendConnection.client.vr.createPlacedObject.mutate({
        vrSpaceId: vrSpaceStore.writableVrSpaceState.dbData.vrSpaceId,
        type: 'vrPortal',
        objectId: portalTargetVrSpace.value,
        position: point,
      });
  }
}

function cancelRaycasting() {
  currentRaycastReason.value = undefined;
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
    if (!vrSpaceStore.writableVrSpaceState) return;
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
    vrSpaceStore.writableVrSpaceState.dbData.panoramicPreviewAssetId = response.assetId;
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
