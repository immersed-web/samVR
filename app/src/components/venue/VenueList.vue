<template>
  <div class="flex flex-wrap gap-2">
    <div v-for="venue in props.venues" :key="venue.streamId">
      <pre>{{ venue }}</pre>
      <VenueThumb :venue="venue" @click="emit('venuePicked', venue)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import VenueThumb from '@/components/venue/VenueThumb.vue';
import type { StreamListInfo } from 'schemas';

const props = defineProps<{ venues: StreamListInfo[] }>();

const emit = defineEmits<{
  (e: 'venuePicked', venue: StreamListInfo): void,
}>();

</script>

<style scoped>

</style>
