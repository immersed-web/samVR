<template>
  <UserBanner></UserBanner>
  <div v-if="!vrSpaceStore.writableVrSpaceState">loading...</div>
  <div v-else>
    <div class="flex mb-4">
      <h2 class="flex-1">
        VR-lobby
        <input class="input input-bordered" v-model="vrSpaceStore.writableVrSpaceState.dbData.name">
      </h2>
      <input type="checkbox" class="toggle toggle-success" true-value="public" false-value="private"
        v-model="vrSpaceStore.writableVrSpaceState.dbData.visibility">
    </div>
    <div>
      <div>{{ selectedUser?.username }}</div>
      <Combobox v-model="selectedUser">
        <div class="w-72 relative">

          <div class="join input input-bordered">
            <ComboboxInput class="join-item" :display-value="(user) => user.username"
              @change="query = $event.target.value" />
            <ComboboxButton class="join-item"><span class="material-icons">unfold_more</span></ComboboxButton>
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
          :key="permissionLevel">{{ permissionLevel }}</option>
      </select>
      <button @click="addEditPermission" class="btn btn-primary">Lägg till som ägare</button>
      <div>
        <h3>Tillagda användare</h3>
        <div v-for="userPermission in vrSpaceStore.currentVrSpace?.dbData.allowedUsers"
          :key="userPermission.user.userId">{{ userPermission.user.username }}: {{ userPermission.permissionLevel }}
        </div>
      </div>
    </div>
    <div>
      <div v-if="vrSpaceStore.currentVrSpace" class="flex flex-col gap-4">
        <div class="flex items-center justify-start gap-2 -mb-2">
          <h3>
            3D-modell
          </h3>
          <div
            class="tooltip cursor-help select-none before:text-left before:whitespace-pre-line flex flex-col max-h-fit justify-center"
            data-tip="Använd musen för att interagera med modellen.
                      Klicka och dra: Rotera bilden
                      Högermus och dra: Panorera längs golvytan
                      Scrolla: Zooma">
            <span class="material-icons">help</span>
          </div>
        </div>
        <div v-if="vrSpaceStore.currentVrSpace.dbData.worldModelAsset" class="grid gap-2">
          <VrAFramePreview class="flex-1 border" ref="vrComponentTag"
            :model-url="getAssetUrl(vrSpaceStore.currentVrSpace.dbData.worldModelAsset.generatedName)"
            :navmesh-url="getAssetUrl(vrSpaceStore.currentVrSpace.dbData.navMeshAsset?.generatedName)"
            :raycast="currentRaycastReason !== undefined" :auto-rotate="currentRaycastReason === undefined"
            @raycast-click="onRaycastClick" @raycast-hover="onRaycastHover">
            <a-entity ref="spawnPosTag" v-if="spawnPosString" :position="spawnPosString">
              <a-circle color="yellow" transparent="true" opacity="0.5" rotation="-90 0 0" position="0 0.05 0"
                :radius="vrSpaceStore.currentVrSpace?.dbData.spawnRadius" />
              <a-icosahedron v-if="vrSpaceStore.currentVrSpace?.dbData.panoramicPreview" detail="3"
                scale="-0.5 -0.5 -0.5"
                :material="`shader: pano-portal-dither; src: ${getAssetUrl(vrSpaceStore.currentVrSpace?.dbData.panoramicPreview?.generatedName)}`">
              </a-icosahedron>
            </a-entity>
          </VrAFramePreview>
          <div class="flex gap-2">
            <input type="radio" :value="undefined" class="hidden" v-model="currentRaycastReason">
            <input type="radio" value="spawnPosition" aria-label="Placera startplats" class="btn btn-sm btn-primary"
              v-model="currentRaycastReason">
            <input type="radio" value="selfPlacement" aria-label="Hoppa in världen" class="btn btn-sm btn-primary"
              v-model="currentRaycastReason">
            <button v-if="currentRaycastReason" class="btn btn-sm btn-circle" @click="currentRaycastReason = undefined">
              <span class="material-icons">close</span>
            </button>
            <div>{{ vrSpaceStore.currentVrSpace.dbData.spawnPosition }}</div>
          </div>
          <!-- <label class="label gap-2">
            <span class="label-text font-semibold whitespace-nowrap">
              Entré rotation
            </span>
            <input type="range" min="0" max="360" v-model.number="entranceRotation" @change="onEntranceRotationCommited"
              class="range">
          </label> -->
          <label class="label gap-2">
            <span class="label-text font-semibold whitespace-nowrap">
              Startplats storlek
            </span>
            <input type="range" min="1" max="20" step="0.1"
              v-model.number="vrSpaceStore.writableVrSpaceState.dbData.spawnRadius" class="range">
          </label>
          <div id="canvas-container" class="*:w-4/5">

          </div>
        </div>
        <div>
          <div>
            <h4>3D-modell för miljön</h4>
            <pre>{{ vrSpaceStore.currentVrSpace.dbData.worldModelAsset?.originalFileName }}</pre>
            <UploadModelForm @uploaded="onModelUploaded" :acceptedAssetTypes="['model']" name="miljömodell" />
          </div>
          <div v-if="vrSpaceStore.currentVrSpace?.dbData.worldModelAsset">
            <h4>3D-modell för gåbara ytor (navmesh)</h4>
            <pre>{{ vrSpaceStore.currentVrSpace.dbData.navMeshAsset?.originalFileName }}</pre>
            <UploadModelForm @uploaded="onNavmeshUploaded" acceptedAssetTypes="navmesh" name="navmesh" />
          </div>
        </div>
        <div class="flex gap-4">
          <h4>Färg på himmelen</h4>
          <input class="rounded-md border-black border-2" type="color"
            v-model="vrSpaceStore.writableVrSpaceState.dbData.skyColor">
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import UploadModelForm, { type EmitTypes } from './UploadModelForm.vue';
import VrAFramePreview from '@/components/lobby/LobbyAFramePreview.vue';
import { ref, watch, onMounted, computed, type ComponentInstance } from 'vue';
// import { throttle } from 'lodash-es';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from '@headlessui/vue';
import { insertablePermissionHierarchy, type VrSpaceId } from 'schemas';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import type { RouterOutputs } from '@/modules/trpcClient';
import UserBanner from '@/components/UserBanner.vue';
import { getAssetUrl, uploadFileData } from '@/modules/utils';

// TODO: refine/find alternative way to get these types so we get intellisense for the emit key
type ExtractEmitData<T extends string, emitUnion extends (...args: any[]) => void> = T extends Parameters<emitUnion>[0] ? Parameters<emitUnion>[1] : never
type UploadEventPayload = ExtractEmitData<'uploaded', EmitTypes>
type ScreenshotPayload = ExtractEmitData<'screenshot', ComponentInstance<typeof VrAFramePreview>['$emit']>

// Use imports
// const router = useRouter();
const backendConnection = useConnectionStore();
const vrSpaceStore = useVrSpaceStore();
const authStore = useAuthStore();

const vrComponentTag = ref<ComponentInstance<typeof VrAFramePreview>>();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();

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

const uncommitedSpawnPosition = ref<Point>()
const spawnPosString = computed(() => {
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
  if (!selectedUser.value) return
  const repsonse = await backendConnection.client.user.createPermission.mutate({
    userId: selectedUser.value.userId,
    targetId: props.vrSpaceId,
    targetType: 'vrSpace',
    permissionLevel: selectedPermission.value
  })
}

onMounted(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);

  users.value = await backendConnection.client.user.getAllUsers.query();
  const sp = vrSpaceStore.currentVrSpace?.dbData.spawnPosition;
  if (sp) uncommitedSpawnPosition.value = sp as Point

  // const storeRot = vrSpaceStore.currentVrSpace?.worldModelAsset?.entranceRotation;
  // if (storeRot) {
  //   entranceRotation.value = storeRot;
  // }
  // const sRadius = vrSpaceStore.currentVrSpace?.dbData.spawnRadius;
  // if (sRadius) {
  //   spawnRadius.value = sRadius;
  // }

});

const skyColor = ref();

type RaycastReason = 'spawnPosition' | 'selfPlacement' | undefined;
const currentRaycastReason = ref<RaycastReason>();

type Point = [number, number, number];

async function onRaycastHover(point: Point) {
  switch (currentRaycastReason.value) {
    case 'spawnPosition':
      uncommitedSpawnPosition.value = point
      break;
    // case 'selfPlacement':
    //   break;
  }
  console.log('raycast intersection:', point);
}

async function onRaycastClick(point: Point) {
  console.log('raycast click:', point);
  const raycastReason = currentRaycastReason.value;
  currentRaycastReason.value = undefined;
  switch (raycastReason) {
    case 'spawnPosition':
      if (!vrSpaceStore.writableVrSpaceState) return;
      vrSpaceStore.writableVrSpaceState.dbData.spawnPosition = point
      const canvas = await vrComponentTag.value?.getPanoScreenshotFromPoint(point);
      if (!canvas) return;
      uploadScreenshot(canvas);
      break;
    case 'selfPlacement':
      if (!vrSpaceStore.writableVrSpaceState) return;
      break;
  }
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
    data.set('assetType', 'image')
    data.set('showInUserLibrary', 'false')
    const response = await uploadFileData({
      data,
      authToken: authStore.tokenOrThrow(),
      abortController: abortController,
    });
    if ('error' in response) {
      console.error('failed to upload screenshot', response);
      return;
    };
    vrSpaceStore.writableVrSpaceState.dbData.panoramicPreviewAssetId = response.assetId
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
