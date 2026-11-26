<template>
  <div class="w-full max-w-sm shadow-2xl card bg-base-100">
    <form class="card-body" @submit.prevent="emit('submit', username, password)">
      <h2 class="text-lg">
        {{ title }}
      </h2>
      <div class="form-control">
        <!-- <label class="label">
          <span class="label-text">Användarnamn</span>
        </label> -->
        <input v-model="username" type="text" placeholder="Användarnamn" class="input input-bordered">
      </div>
      <div class="form-control">
        <!-- <label class="label">
          <span class="label-text">Lösenord</span>
        </label> -->
        <input v-model="password" type="password" placeholder="Lösenord" class="input input-bordered">
      </div>
      <div v-if="error" class="alert bg-error rounded-md mt-2">
        {{ error.message }}
      </div>
      <div class="mt-6 form-control">
        <button type="submit" class="btn btn-primary">
          Logga in
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const username = ref('');
const password = ref('');

const emit = defineEmits<{
  'submit': [username: string, password: string],
}>();

withDefaults(defineProps<{
  title?: string,
  description?: string,
  error?: Error,
}>(), {
  error: undefined,
  title: 'Välkommen till SamVR',
  description: 'Logga in för att delta i kulturevenemang i VR/360',
});
</script>
