<template>
  <div class="flex flex-col gap-8">
    <h1 class=" text-3xl font-bold">
      VR-scener
    </h1>
    <!-- <pre>{{ availableVrSpaces }}</pre> -->
    <div v-if="canCreateVrSpace">
      <button class="btn btn-primary self-start" @click="createVrSpace">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
          class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Skapa ny VR-scen
      </button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      <div class="flex gap-2 items-center" v-for="space in availableVrSpaces" :key="space.vrSpaceId">
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
    <!-- <div class="space-x-2" v-if="canCreateVrSpace">
      <input class="input input-primary" v-model="spaceName">
      <button class="btn btn-primary" :disabled="!spaceName" @click="createVrSpace">
        Skapa
        Vr-miljö
      </button>
    </div> -->
  </div>
</template>
<script setup lang="ts">
import UserBanner from '@/components/UserBanner.vue';
import type { RouterOutputs } from '@/modules/trpcClient';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { type VrSpaceId, hasAtLeastSecurityRole, hasAtLeastPermissionLevel } from 'schemas';
import { computed, onBeforeMount, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { getAssetUrl } from '@/modules/utils';

const router = useRouter();

const connection = useConnectionStore();
const vrSpaceStore = useVrSpaceStore();
const clientStore = useClientStore();
const authStore = useAuthStore();

const availableVrSpaces = ref<RouterOutputs['vr']['listAvailableVrSpaces']>([]);
onBeforeMount(async () => {
  fetchVrSpaceList();
});

async function fetchVrSpaceList() {
  availableVrSpaces.value = await connection.client.vr.listAvailableVrSpaces.query();
}

const spaceName = ref('Min VR-scen');
const canCreateVrSpace = computed(() => {
  // if (!clientStore.clientState) return false;
  // return hasAtLeastSecurityRole(clientStore.clientState.role, 'user');
  return hasAtLeastSecurityRole(authStore.role, 'user');
});

async function createVrSpace() {
  await vrSpaceStore.createVrSpace(spaceName.value);
  await fetchVrSpaceList();
  if (!availableVrSpaces.value) { return; }
  goToVrSpaceSettings(availableVrSpaces.value.slice(-1)[0].vrSpaceId);
}

function goToVrSpaceSettings(vrSpaceId: VrSpaceId) {
  // console.log(vrSpaceId);
  const route = router.push({ name: 'vrSpaceSettings', params: { vrSpaceId } });
  // console.log(route);
}

</script>
