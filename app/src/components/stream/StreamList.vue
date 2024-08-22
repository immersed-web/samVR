<template>
  <div class="grid-cols-6 grid gap-4 ">
    <div v-for="stream in props.streams" :key="stream.streamId" class="">
      <StreamThumb :stream="stream" @click="emit('streamPicked', stream)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import StreamThumb from '@/components/stream/StreamThumb.vue';
import type { StreamListInfo } from 'schemas';

const props = defineProps<{ streams: StreamListInfo[] }>();

const emit = defineEmits<{
  (e: 'streamPicked', stream: StreamListInfo): void,
}>();

</script>

<style scoped></style>
