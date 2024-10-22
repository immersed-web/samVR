<template>
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
    <VRList :max="6" />
  </div>
</template>

<script setup lang="ts">
// import UserBanner from '@/components/UserBanner.vue';
import ColumnCenter from '@/components/layout/ColumnCenter.vue';
import VRList from '@/components/VRList.vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
</script>

