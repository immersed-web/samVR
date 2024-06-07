<template>
  <div>
    <div class="flex mb-4">
      <h2 class="flex-1">
        <!-- <span class="material-icons">videocam</span> -->
        Kameror
      </h2>
      <RouterLink :to="{ name: 'adminCameras' }">
        <button class="btn btn-primary btn-sm">
          <span class="material-icons">settings</span>
          Redigera
        </button>
      </RouterLink>
    </div>
    <div>
      <CamerasList />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStreamStore } from '@/stores/streamStore';
import CamerasList from '@/components/stream/CamerasList.vue';

// Use imports
const streamStore = useStreamStore();

</script>
