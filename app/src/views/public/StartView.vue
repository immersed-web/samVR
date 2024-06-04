<template>
  <UserBanner>Hej&nbsp; </UserBanner>
  <div class="flex gap-2 flex-col items-start my-6">

    <RouterLink :to="{ name: 'streamList' }">
      <button class="btn btn-primary">Till Kamerasändningarna ></button>
    </RouterLink>
    <RouterLink :to="{ name: 'vrList' }">
      <button class="btn btn-primary">Till Vr-miljöerna ></button>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import UserBanner from '@/components/UserBanner.vue';
</script>