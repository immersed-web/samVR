<template>
  <div class="flex items-center">
    <h2>
      <slot>Välkommen&nbsp;</slot>
    </h2>
    <template v-if="authStore.role && hasAtLeastSecurityLevel(authStore.role, 'admin')">
      <h2 class="inline">
        <span class="underline decoration-dashed decoration-accent">
          {{ authStore.username }}!
        </span>
      </h2>
      <RouterLink :to="{ name: 'adminHome' }">
        <button class="btn btn-sm btn-outline btn-primary ml-4">
          Admininställningar
          <span class="material-icons">arrow_right</span>
        </button>
      </RouterLink>
    </template>
    <div class="flex gap-2 items-center" v-else-if="!isEditingUsername">
      <h2 class="inline">
        <span class="underline decoration-dashed decoration-accent">
          {{ authStore.username }}!
        </span>
      </h2>
      <button @click="isEditingUsername = true" class="btn btn-sm btn-square">
        <span class="material-icons">edit</span>
      </button>
    </div>
    <div class="join" v-else>
      <input @keypress.enter="updateUsername" v-model="username" class="input join-item input-bordered input">
      <button @click="updateUsername" class="join-item btn btn-primary "><span
          class="material-icons">save</span></button>
      <button @click="isEditingUsername = false" class="join-item btn btn-error"><span
          class="material-icons">cancel</span></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { hasAtLeastSecurityLevel } from 'schemas';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const username = ref(authStore.username);
const isEditingUsername = ref(false);
async function updateUsername() {
  // await connection.close();
  // await authStore.logout()
  await authStore.autoGuest(username.value);
  // await connection.createUserClient();
  isEditingUsername.value = false;
}
</script>