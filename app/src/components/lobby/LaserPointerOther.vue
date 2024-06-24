<script setup lang="ts">
import { THREE, } from 'aframe';

const props = defineProps<{
  point?: THREE.Vector3
}>()

</script>

<template v-if="$props.point">
  <a-entity :position="$props.point">
    <!-- TODO: Should a-frame entities perhaps not be updated like below, using dynamic values? -->
    <a-sphere id="laserPoint" scale=".05 .05 .05" color="red"/>
  </a-entity>
</template>