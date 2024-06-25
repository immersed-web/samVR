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
    <p>Laddar..</p>
  </slot>
  <slot v-else />
</template>