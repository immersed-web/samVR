<template>
  <div class="flex flex-col items-center">
    <DefaultHeader class="flex-none" />
    <ColumnCenter>
      <RouterView />
    </ColumnCenter>
  </div>
</template>

<script setup lang="ts">

import { useAuthStore } from '@/stores/authStore';

import DefaultHeader from '@/components/layout/DefaultHeader.vue';
import ColumnCenter from '@/components/layout/ColumnCenter.vue';

const authStore = useAuthStore();

</script>

<style scoped>

</style>
