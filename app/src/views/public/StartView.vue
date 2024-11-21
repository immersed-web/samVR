<template>
  <MaxWidth7xl>
    <h1 class="text-3xl font-bold">
      Välkommen {{ authStore.username }}!
    </h1>

    <p class="text-lg italic text-gray-600">
      Välkommen till SamVR! Här kan du utforska och fördjupa dig i fantastiska VR-scener som tar din
      upplevelse till en ny nivå.
    </p>

    <div class="space-y-2 mt-4">
      <h2 class="text-2xl font-bold">
        VR-scener
      </h2>
      <VRList />
    </div>
  </MaxWidth7xl>
</template>

<script setup lang="ts">
// import UserBanner from '@/components/UserBanner.vue';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';
import VRList from '@/components/VRList.vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
</script>

