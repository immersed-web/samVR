<template>
  <div class="hero h-screen">
    <div class="flex flex-col gap-4 items-center">
      <h1 class="text-5xl font-bold">
        Välkommen till {{ appName }}
      </h1>
      <p class="my-4">
        Välj ett namn och klicka på gå in för att komma vidare
      </p>
      <div class="flex w-fit items-center gap-4">
        <div class="join border border-neutral-600">
          <input v-model="guestUsername" class="input join-item min-w-60">
          <div class="tooltip" data-tip="slumpa ett namn">
            <button class="btn btn-circle btn-ghost join-item" @click="generateUsername">
              <span class="material-icons">replay</span>
            </button>
          </div>
        </div>
        <button @click="guestContinue()" class="btn btn-primary">
          Gå in
        </button>
      </div>
    </div>
    <div class="fixed bottom-0 right-0 card card-compact">
      <div class="card-body">
        <RouterLink class="flex gap-1 items-center text-secondary " :to="{ name: 'login' }">
          <span class="text-base">
            Inloggning
          </span>
          <span class="material-icons">keyboard_arrow_right</span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';

const appName = import.meta.env.EXPOSED_PROJECT_NAME;

const router = useRouter();
const fromRoute = router.currentRoute.value.redirectedFrom;
console.log('fromRoute:', fromRoute);
const authStore = useAuthStore();

const guestUsername = ref<string>();

async function generateUsername() {
  await authStore.logout();
  await authStore.autoGuest();
  guestUsername.value = authStore.username;
}

const guestContinue = async () => {
  await authStore.autoGuest(guestUsername.value);
  // const connectionStore = useConnectionStore();
  // connectionStore.createUserClient();
  if (fromRoute?.name === 'userStream') {
    console.log('routing back to the stream');
    router.push(fromRoute);
    return;
  }
  router.push({ name: 'start' });
};
</script>