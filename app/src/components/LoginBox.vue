<template>
  <div class="w-full max-w-sm shadow-2xl card bg-base-100">
    <form class="card-body" @submit.prevent="emit('submit', username, password)">
      <h2 class="text-lg">
        {{ title }}
      </h2>
      <div class="form-control">
        <label class="label">
          <span class="label-text">Användarnamn</span>
        </label>
        <input v-model="username" type="text" placeholder="E-post" class="input input-bordered">
      </div>
      <div class="form-control">
        <label class="label">
          <span class="label-text">Lösenord</span>
        </label>
        <input v-model="password" type="password" placeholder="Löesnord" class="input input-bordered">
      </div>
      <div v-if="error" class="alert bg-error rounded-md mt-2">
        {{ error.message }}
      </div>
      <div class="mt-6 form-control">
        <button type="submit" class="btn btn-primary">
          Logga in
        </button>
      </div>
      <div v-once v-if="showDevLoginButtons" class="space-x-2 text-sm">
        <div class="divider">
          Hackare?
        </div>
        Smit in som:
        <button @click.prevent="emit('submit', 'klas', '123')" class="btn btn-xs btn-primary btn-outline">
          Klas <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
            <path fill-rule="evenodd"
              d="M5 4a.75.75 0 0 1 .738.616l.252 1.388A1.25 1.25 0 0 0 6.996 7.01l1.388.252a.75.75 0 0 1 0 1.476l-1.388.252A1.25 1.25 0 0 0 5.99 9.996l-.252 1.388a.75.75 0 0 1-1.476 0L4.01 9.996A1.25 1.25 0 0 0 3.004 8.99l-1.388-.252a.75.75 0 0 1 0-1.476l1.388-.252A1.25 1.25 0 0 0 4.01 6.004l.252-1.388A.75.75 0 0 1 5 4ZM12 1a.75.75 0 0 1 .721.544l.195.682c.118.415.443.74.858.858l.682.195a.75.75 0 0 1 0 1.442l-.682.195a1.25 1.25 0 0 0-.858.858l-.195.682a.75.75 0 0 1-1.442 0l-.195-.682a1.25 1.25 0 0 0-.858-.858l-.682-.195a.75.75 0 0 1 0-1.442l.682-.195a1.25 1.25 0 0 0 .858-.858l.195-.682A.75.75 0 0 1 12 1ZM10 11a.75.75 0 0 1 .728.568.968.968 0 0 0 .704.704.75.75 0 0 1 0 1.456.968.968 0 0 0-.704.704.75.75 0 0 1-1.456 0 .968.968 0 0 0-.704-.704.75.75 0 0 1 0-1.456.968.968 0 0 0 .704-.704A.75.75 0 0 1 10 11Z"
              clip-rule="evenodd" />
          </svg>
        </button>
        <button @click.prevent="emit('submit', 'göran', '123')" class="btn btn-xs btn-primary btn-outline">
          Göran <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
            <path
              d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
          </svg>
        </button>
        <button @click.prevent="emit('submit', 'fia', '123')" class="btn btn-xs btn-primary btn-outline">
          Fia <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="size-4">
            <path
              d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
          </svg>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const showDevLoginButtons = import.meta.env.DEV;

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
