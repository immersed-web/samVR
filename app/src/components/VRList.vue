<template>
  <div class="flex flex-col gap-4">
    <div class="flex gap-2">
      <template v-if="showAllButton">
        <button class="btn btn-primary self-start" @click="goToVRListView">
          Visa alla {{ availableVrSpaces?.length }} scener
        </button>
      </template>
      <template v-if="canCreateVrSpace">
        <button class="btn btn-primary self-start" @click="createVrSpace">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Skapa ny VR-scen
        </button>
      </template>
    </div>
    <div class="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <div class="flex gap-2 items-center" v-for="space in listedVrSpaces" :key="space.vrSpaceId">
        <div class="card card-compact w-full shadow-xl">
          <figure class="w-full h-32" style="background-size: cover"
            :style="{ 'background-image': 'url(' + (space.image ? getAssetUrl(space.image) : 'https://plus.unsplash.com/premium_photo-1663091704223-cc051e0f0c47?q=80&w=2073&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D') + ')' }" />
          <div class="card-body bg-base-400 ">
            <h2 class="card-title">
              {{ space.name }}
            </h2>
            <div>
              <div>Synlighet: {{ space.visibility }}</div>
              <div>Din rättighetsnivå: {{ space.permissionLevel }}</div>
            </div>
            <div class="card-actions justify-end">
              <button v-if="space.permissionLevel && hasAtLeastPermissionLevel(space.permissionLevel, 'edit')"
                @click="goToVrSpaceSettings(space.vrSpaceId)" class="btn btn-sm">
                Redigera
              </button>
              <RouterLink :to="{ name: 'vrSpace', params: { vrSpaceId: space.vrSpaceId } }">
                <button class="btn btn-primary btn-sm">
                  Besök
                </button>
              </RouterLink>
            </div>
          </div>
        </div>
        <!-- <pre>{{ space }}</pre> -->
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { RouterOutputs } from '@/modules/trpcClient';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { type VrSpaceId, hasAtLeastPermissionLevel, hasAtLeastSecurityRole } from 'schemas';
import { onBeforeMount, ref, computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { getAssetUrl } from '@/modules/utils';

const router = useRouter();

const connection = useConnectionStore();
const authStore = useAuthStore();
const vrSpaceStore = useVrSpaceStore();

const props = defineProps({
  max: { type: Number, default: -1 },
});

const availableVrSpaces = ref<RouterOutputs['vr']['listAvailableVrSpaces']>([]);
const listedVrSpaces = computed(() => {
  return props.max === -1 ? availableVrSpaces.value : availableVrSpaces.value?.slice(0, props.max);
});
onBeforeMount(async () => {
  fetchVrSpaceList();
});

const showAllButton = computed(() => {
  if (!availableVrSpaces.value || !listedVrSpaces.value) { return false; }
  return availableVrSpaces.value.length > listedVrSpaces.value.length;
});

const canCreateVrSpace = computed(() => {
  return hasAtLeastSecurityRole(authStore.role, 'user');
});

const spaceName = ref('Min VR-scen');
async function createVrSpace() {
  // TODO: return created VR space so we don't need to fetch the full list
  await vrSpaceStore.createVrSpace(spaceName.value);
  await fetchVrSpaceList();
  if (!availableVrSpaces.value) { return; }
  goToVrSpaceSettings(availableVrSpaces.value.slice(-1)[0].vrSpaceId);
}

async function fetchVrSpaceList() {
  availableVrSpaces.value = await connection.client.vr.listAvailableVrSpaces.query();
}

function goToVRListView() {
  // console.log(vrSpaceId);
  router.push({ name: 'vrList' });
  // console.log(route);
}

function goToVrSpaceSettings(vrSpaceId: VrSpaceId) {
  // console.log(vrSpaceId);
  router.push({ name: 'vrSpaceSettings', params: { vrSpaceId } });
  // console.log(route);
}

</script>
