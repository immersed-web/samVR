<template>
  <UserBanner>Hej&nbsp; </UserBanner>
  <h3>Vr miljöer</h3>
  <div>
    <div class="flex gap-2 items-center" v-for="space in availableVrSpaces">
      <p>{{ space.name }}</p>
      <pre>{{ space }}</pre>
      <button v-if="space.permissionLevel && hasAtLeastPermissionLevel(space.permissionLevel, 'edit')"
        @click="goToVrSpaceSettings(space.vrSpaceId)" class="btn btn-xs">redigera</button>
    </div>
  </div>
  <div class="space-x-2" v-if="canCreateVrSpace">
    <input class="input input-primary" v-model="spaceName" />
    <button class="btn btn-primary" :disabled="!spaceName" @click="createVrSpace">Skapa
      Vr-miljö</button>
  </div>
</template>
<script setup lang="ts">
import UserBanner from '@/components/UserBanner.vue';
import type { RouterOutputs } from '@/modules/trpcClient';
import { useClientStore } from '@/stores/clientStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { type VrSpaceId, hasAtLeastSecurityRole, hasAtLeastPermissionLevel } from 'schemas';
import { computed, onBeforeMount, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const connection = useConnectionStore()
const vrSpaceStore = useVrSpaceStore();
const clientStore = useClientStore();

const availableVrSpaces = ref<RouterOutputs['vr']['listAvailableVrSpaces']>([]);
onBeforeMount(async () => {
  fetchVrSpaceList();
})

async function fetchVrSpaceList() {
  availableVrSpaces.value = await connection.client.vr.listAvailableVrSpaces.query()
}

const spaceName = ref('');
const canCreateVrSpace = computed(() => {
  if (!clientStore.clientState) return false;
  return hasAtLeastSecurityRole(clientStore.clientState.role, 'user');
})

async function createVrSpace() {
  await vrSpaceStore.createVrSpace(spaceName.value);
  fetchVrSpaceList();
}

function goToVrSpaceSettings(vrSpaceId: VrSpaceId) {
  // console.log(vrSpaceId);
  const route = router.push({ name: 'vrSpaceSettings', params: { vrSpaceId } });
  // console.log(route);
}

</script>