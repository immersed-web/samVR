<template>
  <div class="flex flex-col gap-4">
    <!-- <div class="flex gap-2">
      <template v-if="showAllButton">
        <button class="btn btn-primary self-start" @click="goToVRListView">
          Visa alla {{ availableVrSpaces?.length }} scener
        </button>
      </template>
      <template v-if="canCreateVrSpace">
        <button class="btn btn-primary self-start" @click="createVrSpace">
          <span class="material-icons">add</span>
          Skapa ny VR-scen
        </button>
      </template>
    </div> -->
    <div class="w-full grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4 items-stretch">
      <div v-for="space in listedVrSpaces" :key="space.vrSpaceId" class="card card-compact w-full shadow-xl">
        <figure class="w-full h-32" style="background-size: cover"
          :style="{ 'background-image': 'url(' + (space.image ? `${getAssetUrl(space.image)}?scaledown=8` : 'https://plus.unsplash.com/premium_photo-1663091704223-cc051e0f0c47?q=80&w=2073&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D') + ')' }" />
        <div class="card-body bg-base-400 ">
          <h2 class="card-title">
            {{ space.name }}
          </h2>
          <div class="grow">
            <div>Synlighet: {{ translateVisibility(space.visibility) }}</div>
            <div v-if="space.permissionLevel">Din rättighetsnivå: {{
              translatePermissionLevelAdjective(space.permissionLevel) }}</div>
            <div v-if="space.description">{{ space.description }}</div>
          </div>
          <div class="card-actions justify-end">
            <RouterLink tag="button"
              v-if="space.permissionLevel && hasAtLeastPermissionLevel(space.permissionLevel, 'edit')"
              :to="{ name: 'vrSpaceSettings', params: { vrSpaceId: space.vrSpaceId } }" class="btn btn-sm">
              Redigera
            </RouterLink>
            <RouterLink tag="button" v-else-if="hasAtLeastSecurityRole(authStore.role, 'superadmin')"
              :to="{ name: 'vrSpaceSettings', params: { vrSpaceId: space.vrSpaceId } }" class="btn btn-sm btn-error">
              Redigera (admin)
            </RouterLink>
            <RouterLink tag="button" class="btn btn-primary btn-sm"
              :to="{ name: 'vrSpace', params: { vrSpaceId: space.vrSpaceId } }">
              Besök
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { RouterOutputs } from '@/modules/trpcClient';
import { useConnectionStore } from '@/stores/connectionStore';
import { type VrSpaceId, hasAtLeastPermissionLevel, hasAtLeastSecurityRole, translatePermissionLevelAdjective, translatePermissionLevelVerb, translateVisibility } from 'schemas';
import { onBeforeMount, ref, computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { getAssetUrl } from '@/modules/utils';
import { useAuthStore } from '@/stores/authStore';

const connection = useConnectionStore();
const authStore = useAuthStore();
// const vrSpaceStore = useVrSpaceStore();

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

async function fetchVrSpaceList() {
  availableVrSpaces.value = await connection.client.vr.listAvailableVrSpaces.query();
}

</script>
