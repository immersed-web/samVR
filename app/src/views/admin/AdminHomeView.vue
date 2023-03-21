<template>
  <div>
    <h1 class="mb-4 text-5xl font-bold">
      Välkommen {{ clientStore.clientState.username }}
    </h1>
    <div>
      <h2 class="mb-2 text-3xl font-bold">
        Mina event
      </h2>
      <div class="flex space-x-2">
        <VenueList />
        <div>
          <button
            class="btn btn-outline btn-primary"
            @click="createVenue"
          >
            Skapa ett nytt event
          </button>
        </div>
      </div>
    </div>
    <!-- <button
      class="btn btn-outline btn-primary"
      @click="$router.push({name: 'camera'})"
    >
      Gå till kamera-vy
    </button> -->
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import VenueList from '@/components/venue/VenueList.vue';
import { clientOrThrow, type RouterOutputs } from '@/modules/trpcClient';
import { useClientStore } from '@/stores/clientStore';
import { useAuthStore } from '@/stores/authStore';
import { useVenueStore } from '@/stores/venueStore';
import { onBeforeMount, ref } from 'vue';

// Use imports
const router = useRouter();
const clientStore = useClientStore();
const authStore = useAuthStore();
const venueStore = useVenueStore();

const myVenues = ref<RouterOutputs['admin']['listMyVenues']>();
onBeforeMount(async () => {
  myVenues.value = await clientOrThrow.value.admin.listMyVenues.query();
});

const loadedVenues = ref<RouterOutputs['venue']['listLoadedVenues']>();
onBeforeMount(async () => {
  loadedVenues.value = await clientOrThrow.value.venue.listLoadedVenues.query();
});

// View functionality
async function createVenue () {
  // await clientOrThrow.value.venue.createNewVenue.mutate({name: `event-${Math.trunc(Math.random() * 1000)}`});
  // myVenues.value = await clientOrThrow.value.venue.listMyVenues.query();
  await venueStore.createVenue();
  router.push({name: authStore.routePrefix + 'Venue'});

  // clientStore.createVenue();
}

</script>