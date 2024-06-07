<template>
  <div class="grid md:place-items-center h-screen">
    <div class="fixed top-0 left-0 z-50">
      <div class="p-4">
        <a @click="returnToVenueList" class="flex gap-2 items-center cursor-pointer">
          <div class="btn btn-primary btn-outline btn-circle btn-sm">
            <span class="material-icons">arrow_back</span>
          </div>
          <span class="text-primary">
            Tillbaka till evenemangslistan
          </span>
        </a>
      </div>
    </div>
    <div class="card bg-base-200 p-6 md:m-6 rounded-none md:rounded-2xl">
      <h1 class="text-xl md:text-5xl font-bold md:mt-0 mt-12 mb-8 break-all">
        {{ streamStore.currentStream?.name ?? $props.streamId }}
      </h1>

      <div v-if="!streamStore.currentStream">
        <h2>Försöker ansluta till evented</h2>
      </div>
      <div v-else>
        <div class="flex flex-wrap gap-6 md:gap-12">
          <!-- <div class="flex-1 min-w-56">
            <div v-if="venueStore.currentStream.vrSpace">
              <h2 class="mb-2">
                VR-lobby
              </h2>

              <p class="my-2">
                <span class="material-icons text-sm"
                  :class="venueStore.doorsAreOpen ? 'text-green-500' : 'text-red-500'">circle</span>
                <strong>Lobbyn är {{ venueStore.doorsAreOpen ? 'öppen' : 'stängd' }}</strong>
              </p>

              <div v-if="venueStore.doorsAreOpen">
                <p class="mb-4">
                  Gå in i eventets VR-lobby och träffa andra besökare till detta event. Du kan använda ett VR-headset
                  eller mus och tangentbord.
                </p>
                <button class="btn btn-primary" @click="openLobby">
                  Gå in i VR-lobby
                </button>
              </div>
              <div v-else-if="venueStore.currentStream.doorsOpeningTime">
                <strong>Lobbyn öppnar:</strong> {{ venueStore.currentStream.doorsOpeningTime?.toLocaleString() }}
                <p v-if="venueStore.secondsUntilDoorsOpen !== undefined" class="max-w-96">
                  Du slussas automatiskt in i lobbyn när den öppnar om <span class="font-black">{{ timeLeftString
                    }}</span>
                </p>
              </div>
            </div>
          </div> -->
          <div class="flex-1 min-w-56">
            <h2 class="mb-2">
              360-ström
            </h2>
            <p class="my-2">
              <span class="material-icons text-sm"
                :class="streamStore.streamIsActive ? 'text-green-500' : 'text-red-500'">circle</span>
              <strong>Sändningen är {{ streamStore.streamIsActive ? 'igång' : 'ej igång' }}</strong>
            </p>

            <div v-if="streamStore.streamIsActive">
              <button @click="goToStream" class="btn btn-primary">
                Gå till kameraström
              </button>
            </div>
            <div v-else-if="streamStore.currentStream.streamStartTime">
              <strong>Sändningen startar:</strong> {{ streamStore.currentStream.streamStartTime?.toLocaleString() }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
// import { useConnectionStore } from '@/stores/connectionStore';
import type { StreamId } from 'schemas';
import { computed, onMounted, watch } from 'vue';
import { useStreamStore } from '@/stores/streamStore';
import { useIntervalFn } from '@vueuse/core';
// const connection = useConnectionStore();
const streamStore = useStreamStore();

const props = defineProps<{
  streamId: StreamId
}>();

// const venueInfo = shallowRef<VenueListInfo>();

if (streamStore.currentStream?.streamId !== props.streamId) {
  const { pause } = useIntervalFn(async () => {
    try {
      console.log('trying to join stream:', props.streamId);
      await streamStore.loadAndJoinStream(props.streamId);
      pause();
    } catch (e) {
      console.error(e);
      console.log('failed to join stream. Will retry soon.');
    }

  }, 5000, { immediateCallback: true });
}

async function returnToVenueList() {
  await streamStore.leaveStream();
  router.replace({ name: 'streamList' })
}

// const timeLeftString = computed(() => {
//   if (venueStore.secondsUntilDoorsOpen === undefined) return undefined;
//   if (venueStore.secondsUntilDoorsOpen < 60) return `${venueStore.secondsUntilDoorsOpen} sekunder`;
//   const minutes = Math.trunc(venueStore.secondsUntilDoorsOpen / 60);
//   return `${minutes} ${minutes > 2 ? 'minuter' : 'minut'}`;
// });

// watch(() => venueStore.secondsUntilDoorsOpen, (secondsLeft) => {
//   if (secondsLeft !== undefined && secondsLeft <= 0) {
//     openLobby();
//   }
// });
function goToStream() {
  if (!streamStore.currentStream) return;
  let mainCameraId = streamStore.currentStream.mainCameraId;
  if(!mainCameraId){
    console.warn('No maincamera set. Falling back to using any camera');
    mainCameraId = Object.values(streamStore.currentStream.cameras)[0].cameraId;
  }
  router.push({
    name: 'userCamera',
    params: {
      streamId: streamStore.currentStream.streamId,
      cameraId: mainCameraId,
    },
  });
}

const router = useRouter();
const openLobby = async () => {
  router.push({name: 'userLobby'});
};

</script>

