<template>
  <div class="transition-all border-2 shadow-xl card bg-base-200 hover:cursor-pointer hover:-translate-y-1">
    <!-- TODO: Show an optional picture here related to the event -->
    <!-- <figure class="bg-gradient-to-br from-primary/35 to-primary h-24"> -->
    <div class="card-body">
      <h1 class="card-title drop-shadow-sm">
        {{ props.stream.name }}
      </h1>
      <!-- </figure> -->
      <div>
        <div class="flex items-center">
          <span class="material-icons mr-3">curtains</span>
          <div>
            <strong>Sändningen startar</strong>
            <br>
            {{ props.stream.streamStartTime?.toLocaleString() || 'ej angivet' }}
          </div>
        </div>
      </div>
      <!-- <div v-if="props.venue.doorsOpeningTime">
        <div class="flex items-center">
          <span class="material-icons mr-3">nightlife</span>
          <div>
            <strong>Lobbyn öppnar</strong>
            <br>
            {{ props.venue.doorsOpeningTime.toLocaleString() }}
          </div>
        </div>
      </div> -->
      <!-- <pre class="text-xs">{{ props.stream }}</pre> -->
    </div>
  </div>
</template>

<script setup lang="ts">

import type { StreamListInfo } from 'schemas';
const props = defineProps<{
  stream: StreamListInfo,
}>();

</script>

<style scoped>

</style>
