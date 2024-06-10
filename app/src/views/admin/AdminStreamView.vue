<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div class="">
        <h1>
          {{ streamStore.currentStream?.name }}
        </h1>
      </div>
      <div>
        <button class="btn btn-error" @click="deleteStream">
          <span class="mr-2 material-icons">delete</span>
          Ta bort event
        </button>
      </div>
    </div>
    <StepsContainer>
      <!-- Visibility -->
      <StepsItem :icon="streamStore.currentVisibilityDetails?.icon">
        <template #title>
          Synlighet: {{ streamStore.currentVisibilityDetails?.name }}
        </template>
        {{ streamStore.currentVisibilityDetails?.description }}
        <div v-auto-animate>
          <button v-if="streamStore.currentStream?.visibility !== 'private'"
            class="btn btn-primary btn-sm flex justify-between" @click="goToStream()">
            Eventets webbplats
            <span class="ml-2 material-icons">open_in_new</span>
          </button>
        </div>
      </StepsItem>

      <!-- Lobby -->
      <!-- <StepsItem icon="nightlife">
        <template #title>
          <span class="material-icons text-sm"
            :class="adminStore.realDoorsAreOpen ? 'text-green-500' : 'text-red-500'">circle</span>
          Lobbyn är {{ adminStore.realDoorsAreOpen ? 'öppen' : 'stängd' }}
        </template>
        <div v-auto-animate>
          <div v-if="venueStore.currentStream?.doorsOpeningTime">
            <span>Listad öppningstid: </span>
            <strong> {{ venueStore.currentStream?.doorsOpeningTime?.toLocaleString() }}</strong>
          </div>
        </div>
        <div v-auto-animate>
          <div v-if="!venueStore.currentStream?.doorsAutoOpen">
            <div>
              {{ venueStore.currentStream?.doorsOpeningTime ? 'Ni öppnar lobbyn manuellt vid utsatt tid.'
              : 'Om ni önskar, kan ni öppna lobbyn manuellt' }}
            </div>
            <div class="">
              <button class="btn btn-sm" :class="!venueStore.doorsAreOpen ? 'btn-primary' : 'btn-error'"
                @click="updateDoors(!venueStore.currentStream?.doorsManuallyOpened)">
                {{ !venueStore.currentStream?.doorsManuallyOpened ? "Öppna" : "Stäng" }} lobbyn
              </button>
            </div>
          </div>
          <div v-else>
            Lobbyn öppnas automatiskt vid utsatt tid.
          </div>
        </div>
      </StepsItem> -->

      <!-- Streaming starts -->
      <StepsItem icon="curtains">
        <template #title>
          <span class="material-icons text-sm"
            :class="streamStore.streamIsActive ? 'text-green-500' : 'text-red-500'">circle</span>
          Sändningen är {{ streamStore.streamIsActive ? 'igång' : 'ej igång' }}
        </template>
        <div v-auto-animate>
          <div v-if="streamStore.currentStream?.streamStartTime">
            <span>Listad starttid: </span>
            <strong> {{ streamStore.currentStream?.streamStartTime?.toLocaleString() }}</strong>
          </div>
        </div>
        <div v-auto-animate>
          <div v-if="!streamStore.currentStream?.streamAutoStart">
            <div>
              {{ streamStore.currentStream?.streamStartTime ? 'Ni startar sändningen manuellt vid utsatt tid.' :
                'Om ni önskar, kan ni starta sändningen manuellt' }}
            </div>
            <div>
              <button class="btn btn-primary btn-sm" @click="startStream" :disabled="!!streamStore.streamIsActive">
                Starta sändning
              </button>
            </div>
          </div>
          <div v-else class="flex-1">
            Sändningen startar automatiskt vid utsatt tid.
          </div>
        </div>
      </StepsItem>

      <!-- Event ends -->
      <StepsItem title="Manuellt avslut" icon="curtains_closed">
        <template #title>
          Avsluta sändning
        </template>
        <div class="flex-1">
          Ni avslutar sändningen manuellt när ni önskar.
        </div>
        <div class="">
          <button class="btn btn-error btn-sm" @click="endStream" :disabled="!streamStore.streamIsActive">
            Avsluta sändning
          </button>
        </div>
      </StepsItem>

      <!-- Event has ended -->
      <StepsItem icon="door_front" :last="true" tooltip="Eventet är avslutat." />
    </StepsContainer>

    <div class="divider" />
    <div class="flex items-stretch pb-6">
      <div class="flex-1">
        <AdminStreamSettings />
      </div>
      <!-- <div class="divider divider-horizontal" />
      <div class="flex-1">
        <AdminVrSpaceSettings />
      </div> -->
      <div class="divider divider-horizontal" />
      <div class="flex-1">
        <AdminCameraSettings />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStreamStore } from '@/stores/streamStore';
import AdminStreamSettings from './components/AdminStreamSettings.vue';
// import AdminVrSpaceSettings from './components/AdminVrSpaceSettings.vue';
import AdminCameraSettings from './components/AdminCameraSettings.vue';
import { useConnectionStore } from '@/stores/connectionStore';
import StepsContainer from '@/components/design/StepsContainer.vue';
import StepsItem from '@/components/design/StepsItem.vue';
import { useAdminStore } from '@/stores/adminStore';
import { useClientStore } from '@/stores/clientStore';

// Router
const router = useRouter();

// Stores
const connection = useConnectionStore();
const streamStore = useStreamStore();
const adminStore = useAdminStore();
const clientStore = useClientStore();

// async function updateDoors(open: boolean){
//   await connection.client.admin.updateVenue.mutate({
//     doorsManuallyOpened: open,
//   });
// }

async function startStream() {
  await connection.client.admin.updateStream.mutate({
    streamManuallyStarted: true,
    streamManuallyEnded: false,
  });
}

async function endStream() {
  await connection.client.admin.updateStream.mutate({
    streamManuallyStarted: false,
    streamManuallyEnded: true,
  });
}

onUnmounted(async () => {
  // if(venueStore.currentVenue){
  //   await venueStore.leaveVenue();
  //   router.push({name: 'adminHome'});
  // }
});


const deleteStream = async () => {
  await adminStore.deleteCurrentStream();
  // TODO: quick hack to make sure venuelist is updated...
  // await clientStore.fetchClientState();
  router.push({ name: 'adminHome' });
};

async function goToStream() {
  // await venueStore.joinVenue(venueId);
  const id = streamStore.currentStream?.streamId;
  const routeData = router.resolve({ name: 'userStream', params: { streamId: id } });
  window.open(routeData.href, '_blank');
}

</script>
