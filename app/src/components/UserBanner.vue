<template>
  <div class="flex flex-wrap items-center">
    <h2 class="leading-none">
      <slot>Välkommen&nbsp;</slot>
    </h2>
    <div class="flex gap-2 items-center" v-if="!isEditingUsername">
      <h2 class="inline">
        <span class="underline decoration-dashed decoration-accent">
          {{ authStore.username }}!
        </span>
      </h2>
      <button v-if="!isAtLeastUser" @click="isEditingUsername = true" class="btn btn-sm btn-square">
        <span class="material-icons">edit</span>
      </button>
    </div>
    <div class="join" v-else>
      <input @keypress.enter="updateUsername" v-model="username" class="input input-sm join-item input-bordered">
      <button @click="updateUsername" class="join-item btn btn-sm btn-primary "><span
          class="material-icons">save</span></button>
      <button @click="isEditingUsername = false" class="join-item btn btn-sm btn-error"><span
          class="material-icons">cancel</span></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { hasAtLeastSecurityRole } from 'schemas';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const isAtLeastUser = computed(() => authStore.role ? hasAtLeastSecurityRole(authStore.role, 'user') : false);
const username = ref(authStore.username);
const isEditingUsername = ref(false);
async function updateUsername() {
  await authStore.autoGuest(username.value);
  isEditingUsername.value = false;
}
</script>