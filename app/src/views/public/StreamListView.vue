<template>
  <div class="flex flex-col gap-4 mb-12 items-start">
    <UserBanner>Hej&nbsp; </UserBanner>
    <div v-if="streamsOngoing.length" class="space-y-2">
      <h3 class="text-base-content/90">
        Pågående event
      </h3>
      <StreamList :streams="streamsOngoing" @stream-picked="(stream) => goToStream(stream.streamId)" />
    </div>

    <div v-if="streamsUpcoming.length">
      <h3 class="text-base-content/90">
        Kommande event
      </h3>
      <StreamList :streams="streamsUpcoming" @stream-picked="(stream) => goToStream(stream.streamId)" />
    </div>

    <div v-if="streamsUnscheduled.length">
      <h3 class="text-base-content/90">
        Event utan datum
      </h3>
      <StreamList :streams="streamsUnscheduled" @stream-picked="(stream) => goToStream(stream.streamId)" />
    </div>
  </div>
</template>

<script setup lang="ts">

import type { RouterOutputs } from '@/modules/trpcClient';
import { useConnectionStore } from '@/stores/connectionStore';
import { computed, onBeforeMount, ref } from 'vue';
import StreamList from '@/components/stream/StreamList.vue';
import { type StreamId, hasAtLeastSecurityLevel } from 'schemas';
import { useRouter } from 'vue-router';
import { isPast } from 'date-fns';
import { streamConsideredActive } from '@/stores/streamStore';
import UserBanner from '@/components/UserBanner.vue';

const router = useRouter();
const streamsAllowed = ref<RouterOutputs['venue']['listAllowedVenues']>([]);

const connection = useConnectionStore();
onBeforeMount(async () => {
  streamsAllowed.value = await connection.client.venue.listAllowedVenues.query();
});

const streamsOngoing = computed(() => {
  return streamsAllowed.value.filter(v => {
    return streamConsideredActive(v);
  });
});

const streamsNotOngoing = computed(() => {
  return streamsAllowed.value.filter(v => !streamsOngoing.value.includes(v));
});

const streamsUpcoming = computed(() => {
  return streamsNotOngoing.value.filter(v => v.streamStartTime && !isPast(v.streamStartTime));
});

const streamsPast = computed(() => {
  return streamsNotOngoing.value.filter(v => v.streamStartTime && isPast(v.streamStartTime));
});

const streamsUnscheduled = computed(() => {
  return streamsNotOngoing.value.filter(v => !v.streamStartTime);
});

async function goToStream(streamId: StreamId) {
  console.log('clicked the stream', streamId);
  router.push({ name: 'userStream', params: { streamId } });
}

</script>
