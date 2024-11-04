<template>
  <a-entity :scale="`${side === 'right' ? '-1' : '1'} 1 1`">
    <a-entity rotation="-130 0 100">
      <a-entity position="-0.5 0.36 -0.03" :gltf-model="`url(/avatar/hands/${part.model}.glb)`" />
    </a-entity>
  </a-entity>
</template>

<script setup lang="ts">
import type { AvatarDesign } from 'schemas';

type Side = 'left' | 'right';
const { side = 'left', part = { model: 'hands_basic_left' } } = defineProps<{
  part?: AvatarDesign['parts']['hands'],
  side?: Side
}>()
</script>