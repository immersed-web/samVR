<template>
  <div>
    <div class="flex mb-4">
      <h2 class="flex-1">
        VR-lobby <input v-if="vrSpaceStore.currentVrSpace" class="input input-bordered"
          v-model="vrSpaceStore.currentVrSpace.dbData.name">
      </h2>
      <input v-if="vrSpaceStore.currentVrSpace" type="checkbox" class="toggle toggle-success" true-value="public"
        false-value="private" v-model="vrSpaceStore.currentVrSpace.dbData.visibility">
      <div>{{ selectedUser }}</div>
      <!-- <pre>{{ users }}</pre> -->
    </div>
    <div>
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
    </div>
    <pre>{{ vrSpaceStore.currentVrSpace }}</pre>
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
          <VrAFramePreview class="flex-1 border"
            :model-url="vrSpaceStore.currentVrSpace.dbData.worldModelAsset.generatedName"
            :navmesh-url="vrSpaceStore.currentVrSpace.dbData.navMeshAsset?.generatedName"
            :cursor-target="currentCursorType" @cursor-placed="onCursorPlaced" />
          <div class="flex gap-2">
            <input type="radio" :value="undefined" class="hidden" v-model="currentCursorType">
            <input type="radio" value="spawnPosition" aria-label="Placera startplats" class="btn btn-sm btn-primary"
              v-model="currentCursorType">
            <input type="radio" value="entrancePosition" aria-label="Placera streaming-entré"
              class="btn btn-sm btn-primary" v-model="currentCursorType">
            <button v-if="currentCursorType" class="btn btn-sm btn-circle" @click="currentCursorType = undefined">
              <span class="material-icons">close</span>
            </button>
          </div>
          <!-- <label class="label gap-2">
            <span class="label-text font-semibold whitespace-nowrap">
              Entré rotation
            </span>
            <input type="range" min="0" max="360" v-model.number="entranceRotation" @change="onEntranceRotationCommited"
              class="range">
          </label> -->
          <!-- <label class="label gap-2">
            <span class="label-text font-semibold whitespace-nowrap">
              Startplats storlek
            </span>
            <input type="range" min="1" max="20" step="0.1" v-model.number="spawnRadius" @change="onSpawnRadiusCommited"
              class="range">
          </label> -->
        </div>
        <!-- <div>
          <div>
            <h4>3D-modell för miljön</h4>
            <AdminUploadModelForm model-type="model" />
          </div>
          <div v-if="streamStore.currentStream?.vrSpace?.virtualSpace3DModel">
            <h4>3D-modell för gåbara ytor (navmesh)</h4>
            <AdminUploadModelForm model-type="navmesh" name="navmesh" />
          </div>
        </div>
        <div class="flex gap-4">
          <h4>Färg på himmelen</h4>
          <input class="rounded-md border-black border border-2" type="color"
            :value="streamStore.currentStream.vrSpace.virtualSpace3DModel.skyColor" @input="setSkyColor">
        </div> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import AdminUploadModelForm from './UploadModelForm.vue';
import VrAFramePreview from '@/components/lobby/LobbyAFramePreview.vue';
import { ref, watch, onMounted, computed } from 'vue';
import { throttle } from 'lodash-es';
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from '@headlessui/vue';
import { insertablePermissionHierarchy, type VrSpaceId } from 'schemas';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import type { RouterOutputs } from '@/modules/trpcClient';

// Use imports
const router = useRouter();
const backendConnection = useConnectionStore();
const vrSpaceStore = useVrSpaceStore();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();

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

// watch(() => vrSpaceStore.writableState, (newPos) => {
//   console.log('vrSpace updated');
//   vrSpaceStore.updateVrSpace();
// }, { deep: true });

// vrSpaceStore.$subscribe((mutation, state) => {
//   console.log('vrSpaceStroe patched', mutation, state);
// })

onMounted(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);

  users.value = await backendConnection.client.user.getAllUsers.query();

  // const storeRot = vrSpaceStore.currentVrSpace?.worldModelAsset?.entranceRotation;
  // if (storeRot) {
  //   entranceRotation.value = storeRot;
  // }
  const sRadius = vrSpaceStore.currentVrSpace?.dbData.spawnRadius;
  if (sRadius) {
    spawnRadius.value = sRadius;
  }

});

const skyColor = ref();

const currentCursorType = ref<'spawnPosition' | 'entrancePosition' | undefined>();
// const entranceRotation = ref(0);
// watch(entranceRotation, (rot) => {
//   if (!vrSpaceStore.currentVrSpace?.placedObjects) return;
//   vrSpaceStore.currentStream.vrSpace.virtualSpace3DModel.entranceRotation = rot;
// });

const spawnRadius = ref(0);
watch(spawnRadius, (radius) => {
  if (!vrSpaceStore.currentVrSpace?.dbData.spawnRadius) return;
  vrSpaceStore.currentVrSpace.dbData.spawnRadius = radius;
});

type Point = [number, number, number];

function onCursorPlaced(point: Point) {
  console.log('cursor placed:', point);
  if (currentCursorType.value === 'entrancePosition') {
    // setEntrancePosition(point);
  } else if (currentCursorType.value === 'spawnPosition') {
    // setSpawnPosition(point);
  }
  currentCursorType.value = undefined;
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
// async function setSpawnPosition(point: Point) {
//   const modelId = vrSpaceStore.currentVrSpace?.spawnPosition;
//   if (!modelId) return;
//   await connectionStore.client.vr.update3DModel.mutate({
//     vr3DModelId: modelId,
//     data: {
//       spawnPosition: point,
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

// const setSkyColor = throttle(async (evt: InputEvent) => {
//   // console.log(evt.data);
//   // console.log(evt.target);
//   // return;
//   const modelId = vrSpaceStore.currentVrSpace.virtualSpace3DModelId;
//   if (!modelId) return;
//   await connectionStore.client.vr.update3DModel.mutate({
//     vr3DModelId: modelId,
//     reason: 'skycolor updated',
//     data: {
//       skyColor: evt.target.value,
//     }
//   })
// }, 800, { trailing: true });

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
