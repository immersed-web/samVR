<template>
  <MaxWidth7xl>
    <AssetLibrary :assets="libraryAssets" />
  </MaxWidth7xl>
</template>
<script setup lang="ts">
import { useClientStore } from '@/stores/clientStore';
import AssetLibrary from '@/components/lobby/AssetLibrary.vue';
import { computed } from 'vue';
import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';

const clientStore = useClientStore();

const libraryAssets = computed(() => {
  return clientStore.clientState?.assets.filter(a => a.showInUserLibrary) ?? [];
});

</script>