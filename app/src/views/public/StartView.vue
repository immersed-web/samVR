<template>
  <MaxWidth7xl>
    <!-- <h1 class="text-3xl font-bold">
      Välkommen {{ authStore.username }}!
    </h1> -->
    <div class="space-y-4">
      <UserBanner />
      <p class="text-lg italic text-gray-600">
        Välkommen till SamVR! Här kan du utforska och fördjupa dig i fantastiska VR-miljöer som tar din
        upplevelse till en ny nivå.
      </p>

      <div class="flex items-center justify-between gap-2">
        <h2 class="text-2xl font-bold">
          VR-miljöer
        </h2>
        <button v-if="canCreateVrSpace" class="btn btn-primary btn-outline btn-sm px-2" @click="createVrSpace">
          <span class="material-icons">add</span>
          Skapa ny VR-miljö
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
import { computed, onMounted, ref } from 'vue';
import { orgApi } from '@/modules/authClient';
import { hasAtLeastSecurityRole } from 'schemas';

const router = useRouter();
const authStore = useAuthStore();
const vrSpaceStore = useVrSpaceStore();

// People whose role is "Användare" in every organization they belong to may visit environments but not create them.
// The media server enforces this too; this only hides the button.
const basicOnly = ref(false);
onMounted(async () => {
  if (!authStore.role || !hasAtLeastSecurityRole(authStore.role, 'user') || hasAtLeastSecurityRole(authStore.role, 'superadmin')) return;
  try {
    const mine = await orgApi.list();
    basicOnly.value = mine.length > 0 && mine.every(o => o.myRole === 'basic');
  } catch {
    basicOnly.value = false;
  }
});
const canCreateVrSpace = computed(() => {
  if (!authStore.role) { return false; }
  return hasAtLeastSecurityRole(authStore.role, 'user') && !basicOnly.value;
});
async function createVrSpace() {
  const prefix = authStore.username ? authStore.username + 's' : '';
  const name = 'plats'
  const suffix = crypto.randomUUID().substring(0, 5);
  const vrSpaceId = await vrSpaceStore.createVrSpace(`${prefix} ${name} ${suffix}`);
  router.push({ name: 'vrSpaceSettings', params: { vrSpaceId } });
}
</script>

