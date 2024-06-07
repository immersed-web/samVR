<template>
  <div>
    <h1 class="text-5xl font-bold">
      Välkommen {{ clientStore.clientState?.username }}
    </h1>
    <div>
      <h2 class="text-3xl font-bold">
        Mina event
      </h2>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClientStore } from '@/stores/clientStore';

const clientStore = useClientStore();

</script>

