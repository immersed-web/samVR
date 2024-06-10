<template>
  <div>
    <div class="min-h-screen z-0">
      <!-- <VrAFrame v-if="streamStore.modelUrl" :model-url="streamStore.modelUrl" :navmesh-url="streamStore.navmeshUrl"
        :model-scale="streamStore.currentStream?.vrSpace?.virtualSpace3DModel?.scale" /> -->
    </div>
  </div>
</template>

<script setup lang="ts">
// import { onMounted } from 'vue';
import VrAFrame from '../../components/lobby/VrAFrame.vue';
// import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useStreamStore } from '@/stores/streamStore';

const streamStore = useStreamStore();
// const vrSpaceStore = useVrSpaceStore();
// onMounted(async () => {
//   await vrSpaceStore.enterVrSpace();
// });

</script>

