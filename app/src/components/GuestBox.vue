<template>
  <div class="flex w-full items-center gap-2 justify-between">
    <div class="join border border-neutral-600 grow">
      <input placeholder="namn" v-model="guestUsername" class="input pe-0 join-item w-20 grow">
      <div class="tooltip" data-tip="slumpa ett namn">
        <button class="btn btn-circle btn-ghost join-item" @click="generateUsername">
          <span class="material-icons">replay</span>
        </button>
      </div>
    </div>
    <button @click="guestContinue" class="btn btn-primary">
      Gå in
    </button>
  </div>
</template>


<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';

// const appName = import.meta.env.EXPOSED_PROJECT_NAME;

const props = defineProps<{
  /** When set, "Gå in" signs in as a guest limited to this one VR space (public gallery). */
  vrSpaceId?: string,
}>();

const emit = defineEmits<{
  'continue': [],
}>();

const router = useRouter();
const fromRoute = router.currentRoute.value.redirectedFrom;
// console.log('fromRoute:', fromRoute);
const authStore = useAuthStore();

const guestUsername = ref<string>();

async function generateUsername() {
  await authStore.logout();
  await authStore.autoGuest();
  guestUsername.value = authStore.username;
}

const guestContinue = async () => {
  if (props.vrSpaceId) {
    await authStore.enterGalleryGuest(props.vrSpaceId, guestUsername.value?.trim() || undefined);
  } else {
    await authStore.autoGuest(guestUsername.value);
  }
  emit('continue');
  // const connectionStore = useConnectionStore();
  // connectionStore.createUserClient();
  // if (fromRoute?.name === 'userStream') {
  //   // console.log('routing back to the stream');
  //   router.push(fromRoute);
  //   return;
  // }
  // router.push({ name: 'start' });
};
</script>