<template>
  <MaxWidth7xl>
    <!-- <h1 class="text-3xl font-bold">
      Välkommen {{ authStore.username }}!
    </h1> -->
    <div class="space-y-4">
      <UserBanner />
      <p class="text-lg italic text-gray-600">
        Välkommen till SamVR! Här kan du utforska och fördjupa dig i fantastiska VR-scener som tar din
        upplevelse till en ny nivå.
      </p>

      <div class="flex items-center justify-between gap-2">
        <h2 class="text-2xl font-bold">
          VR-platser
        </h2>
        <button v-if="canCreateVrSpace" class="btn btn-primary btn-outline btn-sm px-2" @click="createVrSpace">
          <span class="material-icons">add</span>
          Skapa ny VR-scen
        </button>
      </div>
      <VRList />
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';
import UserBanner from '@/components/UserBanner.vue';
import VRList from '@/components/VRList.vue';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import { computed } from 'vue';
import { hasAtLeastSecurityRole } from 'schemas';

const router = useRouter();
const authStore = useAuthStore();
const vrSpaceStore = useVrSpaceStore();

const canCreateVrSpace = computed(() => {
  if (!authStore.role) { return false; }
  return hasAtLeastSecurityRole(authStore.role, 'user');
});
async function createVrSpace() {
  const prefix = authStore.username ? authStore.username + 's ' : '';
  const name = 'plats'
  const suffix = crypto.randomUUID().substring(0, 5);
  const vrSpaceId = await vrSpaceStore.createVrSpace(`${prefix}${name}${suffix}`);
  router.push({ name: 'vrSpaceSettings', params: { vrSpaceId } });
}
</script>

