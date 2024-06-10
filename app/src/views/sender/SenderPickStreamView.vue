<template>
  <div class="grid max-w-xl grid-flow-row gap-4 m-6">
    <button class="btn btn-primary" v-for="venue in streams" :key="venue.streamId" :venue="venue"
      @click="tryToJoinAndEnterCamera(venue)">
      {{ venue.name }}
    </button>
  </div>
</template>
<script lang="ts" setup>
import type { RouterOutputs } from '@/modules/trpcClient';
import { useConnectionStore } from '@/stores/connectionStore';
import { useStreamStore } from '@/stores/streamStore';

import { onBeforeMount, ref } from 'vue';
import { useRouter } from 'vue-router';
type Stream = RouterOutputs['stream']['listAllowedStreams'][number];


const router = useRouter();
const streams = ref<Stream[]>();
// const senderStore = useSenderStore();
const streamStore = useStreamStore();
const connection = useConnectionStore();

onBeforeMount(async () => {
  streams.value = await connection.client.stream.listAllowedStreams.query();
});

function tryToJoinAndEnterCamera(stream: Stream) {
  streamStore.savedStreamId = stream.streamId;
  router.push({ name: 'senderHome' });
}

</script>
