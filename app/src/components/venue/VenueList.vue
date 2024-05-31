<template>
  <div class="flex flex-wrap gap-2">
    <div v-for="venue in props.venues" :key="venue.streamId">
      <VenueThumb :venue="(venue as StreamListInfo)" @click="emit('venuePicked', (venue as StreamListInfo))" />
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
