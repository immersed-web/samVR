<template>
  <h1 class="text-3xl font-bold">
    Välkommen {{ authStore.username }}!
  </h1>

  <div class="space-y-2">
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

