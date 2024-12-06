<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import registerAframeComponents from '@/ts/aframe/components';


const aframeIsLoaded = ref(false);
onBeforeMount(async () => {
  await registerAframeComponents();
  aframeIsLoaded.value = true;
});


</script>

<template>
  <slot name="loading" v-if="!aframeIsLoaded">
    <div class="flex items-center justify-center p-24">
      <span class="loading loading-infinity loading-lg"></span>Laddar coola 3D-grejer
    </div>
  </slot>
  <slot v-else />
</template>