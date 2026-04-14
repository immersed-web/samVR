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
    <div class="flex flex-col gap-3 md:flex-row md:items-center">
      <input
        v-model="searchQuery"
        class="input input-bordered input-primary w-full md:max-w-sm"
        placeholder="Sök VR-scen..."
      />

      <select v-model="visibilityFilter" class="select select-bordered">
        <option value="all">Alla</option>
        <option value="owned">Äger</option>
        <option value="member">Medlem</option>
        <option value="public">Publika</option>
      </select>
      <button class="btn btn-sm" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
        Sortera {{ sortOrder === 'asc' ? 'A → Ö' : 'Ö → A' }}
      </button>
    </div>
    <div class="w-full grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4 items-stretch">
      <div v-for="space in paginatedVrSpaces" :key="space.vrSpaceId" class="card card-compact w-full shadow-xl">
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
    <div class="flex items-center gap-2 mt-4">
      <div class="flex gap-2">
        <button class="btn btn-sm" :disabled="currentPage === 1" @click="currentPage--">
          Föregående
        </button>
        <span class="text-sm leading-none self-center">Sida {{ currentPage }} av {{ totalPages }}</span>
        <button class="btn btn-sm" :disabled="currentPage === totalPages" @click="currentPage++">
          Nästa
        </button>
      </div>
      <select v-model.number="pageSize" class="select select-bordered select-sm">
        <option :value="12">12</option>
        <option :value="24">24</option>
        <option :value="48">48</option>
      </select>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { RouterOutputs } from '@/modules/trpcClient';
import { useConnectionStore } from '@/stores/connectionStore';
import { type VrSpaceId, hasAtLeastPermissionLevel, hasAtLeastSecurityRole, translatePermissionLevelAdjective, translatePermissionLevelVerb, translateVisibility } from 'schemas';
import { onBeforeMount, ref, computed, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { getAssetUrl } from '@/modules/utils';
import { useAuthStore } from '@/stores/authStore';

const connection = useConnectionStore();
const authStore = useAuthStore();
// const vrSpaceStore = useVrSpaceStore();

const searchQuery = ref('');
const visibilityFilter = ref<'all' | 'owned' | 'member' | 'public'>('all');
const currentPage = ref(1);
const pageSize = ref(12);
const sortOrder = ref<'asc' | 'desc'>('asc');

const filteredVrSpaces = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return availableVrSpaces.value.filter(space => {
    const matchesName =
      query === '' || space.name.toLowerCase().includes(query);

    const matchesVisibility =
      visibilityFilter.value === 'all'
        ? true
        : visibilityFilter.value === 'owned'
          ? space.permissionLevel === 'owner'
          : visibilityFilter.value === 'member'
            ? ['admin', 'edit', 'view'].includes(space.permissionLevel ?? '')
            : visibilityFilter.value === 'public'
              ? space.visibility === 'public'
              : true;

    return matchesName && matchesVisibility;
  });
});

const sortedVrSpaces = computed(() => {
  return [...filteredVrSpaces.value].sort((a, b) => {
    return a.name.localeCompare(b.name, 'sv') * (sortOrder.value === 'asc' ? 1 : -1);
  });
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedVrSpaces.value.length / pageSize.value))
);

const paginatedVrSpaces = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedVrSpaces.value.slice(start, start + pageSize.value);
});

watch([searchQuery, visibilityFilter, pageSize], () => {
  currentPage.value = 1;
});

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
