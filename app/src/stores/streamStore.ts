import { defineStore } from 'pinia';
import type { RouterOutputs } from '@/modules/trpcClient';
import { ref, computed, type Ref } from 'vue';
import type { Visibility } from 'database/schema';
import type { StreamId } from 'schemas';
import { useConnectionStore } from '@/stores/connectionStore';
import { useNow, useStorage } from '@vueuse/core';

type _ReceivedPublicStreamState = RouterOutputs['stream']['joinStream'];

export type VisibilityDetails = {
  visibility: Visibility,
  name: string,
  icon: string,
  description: string
}

export function streamConsideredActive(streamState: Pick<_ReceivedPublicStreamState, 'streamAutoStart' | 'streamManuallyStarted' | 'streamStartTime' | 'streamManuallyEnded'>) {
  const now = Date.now();
  // let doorsAreOpen = false;
  // if(venueState.doorsManuallyOpened) doorsAreOpen = true;
  // if(venueState.doorsAutoOpen && venueState.doorsOpeningTime) {
  //   doorsAreOpen = venueState.doorsOpeningTime.getTime() < now;
  // }

  let streamActive = false;
  if (streamState.streamManuallyStarted) streamActive = true;
  if (streamState.streamAutoStart && streamState.streamStartTime && streamState.streamManuallyEnded) {
    streamActive = streamState.streamStartTime.getTime() < now;
  }

  return streamActive;
}

export const useStreamStore = defineStore('stream', () => {
  const now = useNow({ interval: 1000 });
  const connection = useConnectionStore();
  // const authStore = useAuthStore();

  const currentStream = ref<_ReceivedPublicStreamState>();
  const savedStreamId = ref<StreamId>();



  connection.client.stream.subStreamUnloaded.subscribe(undefined, {
    onData() {
      currentStream.value = undefined;
    },
    onError(err) {
      console.error(err);
    },
  });

  connection.client.stream.subStreamStateUpdated.subscribe(undefined, {
    onData(data) {
      console.log('received streamState updated:', data);
      currentStream.value = data.data;
    },
    onError(err) {
      console.error(err);
    },
  });

  // const urlToFileserver = `https://${import.meta.env.EXPOSED_SERVER_URL}${import.meta.env.EXPOSED_FILESERVER_PATH}`;
  // const urlToModelsFolder = urlToFileserver + '/uploads/3d_models/';
  // const modelUrl = computed(() => {
  //   if(!currentVenue.value?.vrSpace?.virtualSpace3DModel?.modelFileFormat){
  //     return undefined;
  //   }
  //   const modelId = currentVenue.value.vrSpace.virtualSpace3DModelId;
  //   const extension = currentVenue.value.vrSpace.virtualSpace3DModel.modelFileFormat;
  //   return urlToModelsFolder + modelId + '.model.' + extension;
  // });
  // const navmeshUrl = computed(() => {
  //   if(!currentVenue.value?.vrSpace?.virtualSpace3DModel?.navmeshFileFormat){
  //     return undefined;
  //   }
  //   const modelId = currentVenue.value.vrSpace.virtualSpace3DModelId;
  //   const extension = currentVenue.value.vrSpace.virtualSpace3DModel.navmeshFileFormat;
  //   return urlToModelsFolder + modelId + '.navmesh.' + extension;
  // });

  async function loadAndJoinStream(streamId: StreamId) {
    currentStream.value = await connection.client.stream.loadAndJoinStream.mutate({ streamId });
    savedStreamId.value = currentStream.value.streamId;
  }

  async function joinStream(streamId: StreamId) {
    // console.log('sending request to join stream:', streamId);
    currentStream.value = await connection.client.stream.joinStream.mutate({ streamId });
    savedStreamId.value = currentStream.value.streamId;
  }

  async function leaveStream() {
    if (!currentStream.value) {
      console.warn('Tried to leave stream when you aren\'t in one.. Not so clever, eh?');
      return;
    }
    await connection.client.stream.leaveCurrentStream.mutate();
    currentStream.value = undefined;
  }


  const visibilityOptions: Ref<VisibilityDetails[]> = ref([
    // {
    //   visibility: 'private',
    //   name: 'Privat',
    //   icon: 'lock',
    //   description: 'Endast du kan se detta event.',
    // },
    {
      visibility: 'unlisted',
      name: 'Olistad',
      icon: 'link',
      description: 'Alla med länken kan se och delta i eventet.',
    },
    {
      visibility: 'public',
      name: 'Publik',
      icon: 'list',
      description: 'Eventet listas öppet på webbplatsen.',
    },
  ] as VisibilityDetails[]);

  const currentVisibilityDetails = computed(() => {
    return visibilityOptions.value.find(o => o.visibility === currentStream.value?.visibility);
  });

  const timeSpread = 30;
  const timeOffset = useStorage('doorTimeOffset', Math.random() * timeSpread);
  // const secondsUntilDoorsOpen = computed(() => {
  //   // if(currentVenue.value?.doorsManuallyOpened) return 0;
  //   if(!currentVenue.value?.vrSpace || !currentVenue.value?.doorsAutoOpen || !currentVenue.value.doorsOpeningTime || currentVenue.value.doorsManuallyOpened) return undefined;
  //   const millis = currentVenue.value.doorsOpeningTime.getTime() - now.value.getTime();
  //   return Math.trunc(Math.max(0, millis*0.001 + timeOffset.value));
  // });

  // const doorsAreOpen = computed(() => {
  //   if(!currentVenue.value) return false;
  //   if(secondsUntilDoorsOpen.value !== undefined){
  //     return secondsUntilDoorsOpen.value === 0;
  //   }
  //   else return currentVenue.value.doorsManuallyOpened;
  // });

  const streamIsActive = computed(() => {
    if (!currentStream.value || currentStream.value.streamManuallyEnded) return false;
    if (currentStream.value.streamAutoStart && currentStream.value.streamStartTime) {
      const isPast = currentStream.value.streamStartTime.getTime() < now.value.getTime();
      return isPast;
    }
    else {
      return currentStream.value.streamManuallyStarted;
    }
  });

  return {
    // doorsAreOpen,
    // secondsUntilDoorsOpen,
    streamIsActive,
    savedStreamId,
    currentStream,
    loadAndJoinStream,
    joinStream,
    leaveStream,
    // modelUrl,
    // navmeshUrl,
    visibilityOptions,
    currentVisibilityDetails,
  };
}, {
  persist: {
    paths: ['savedStreamId'],
  },
});
