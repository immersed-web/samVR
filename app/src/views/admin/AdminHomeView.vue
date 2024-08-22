<template>
  <div class="flex flex-col gap-8">
    <h1 class=" text-5xl font-bold">
      Välkommen {{ authStore.username }}!
    </h1>
    <div>
      <p>Det här är din administratörssida på SamVR.</p>
      <p class="space-x-1">
        Jag vet inte riktigt vad som ska finnas här, eller hur hierarkin <RouterLink :to="{ name: 'streamList' }"
          class="btn btn-sm">
          Event/Strömmar
        </RouterLink>
        <RouterLink :to="{ name: 'vrList' }" class="btn btn-sm">
          VR-spaces
        </RouterLink>
        <RouterLink :to="{ name: 'adminCameras' }" class="btn btn-sm">
          kameror
        </RouterLink> osv. ser ut.
      </p>
      <p>
        I takt med att förståelsen för användarflödet breddas så kommer denna startsida att bli riktigt, riktigt bra.
      </p>
    </div>
    <div class="space-y-2">
      <h2 class="text-2xl mb-1">
        Mina event
      </h2>
      <p>Här ska dina event listas men oftast så laddas de inte <i>(clientStore.clientState?.ownedStreams)</i>.</p>
      <div class="flex space-x-2">
        <StreamList v-if="clientStore.clientState" :streams="streamsAsArray"
          @stream-picked="(stream) => pickStreamAndNavigate(stream.streamId)" />
        <div>
          <button class="btn btn-outline btn-primary" @click="createStream">
            Skapa ett nytt event
          </button>
        </div>
      </div>
    </div>
    <div v-if="hasAtLeastSecurityRole(authStore.role, 'superadmin')" class="space-y-2">
      <h2 class="text-2xl">
        Hantera användare
      </h2>
      <p>
        Skapa nya användare och administratörer. Du har även möjlighet att uppdatera lösenord för befintliga användare
        samt radera användarkonton.
      </p>
      <RouterLink :to="{ name: 'adminUserManager' }" class="btn btn-primary">
        Hantera användare
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import StreamList from '@/components/stream/StreamList.vue';
import { useClientStore } from '@/stores/clientStore';
import { useAuthStore } from '@/stores/authStore';
import { useStreamStore } from '@/stores/streamStore';
import { computed, ref } from 'vue';
import type { StreamId } from 'schemas';
import { useAdminStore } from '@/stores/adminStore';
import { getAdmins, deleteUser } from '@/modules/authClient';
import { hasAtLeastSecurityRole } from 'schemas';

// Use imports
const router = useRouter();
// const connectionStore = useConnectionStore();
const clientStore = useClientStore();
const authStore = useAuthStore();
const streamStore = useStreamStore();
const adminStore = useAdminStore();

const admins = ref<Awaited<ReturnType<typeof getAdmins>>>([]);

const editedUserId = ref<string>();
const editedUsername = ref<string>();
const editedPassword = ref<string>();

const streamsAsArray = computed(() => {
  if(!clientStore.clientState) return [];
  return Object.values(clientStore.clientState?.ownedStreams);
});

// View functionality
async function createStream() {
  await adminStore.createStream();
}

const pickStreamAndNavigate = async (streamId: StreamId) => {
  streamStore.savedStreamId = streamId;
  router.push({ name: authStore.routePrefix + 'Stream' });
};

</script>
