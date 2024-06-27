<script setup lang="ts">
import { toValue, watch } from 'vue';
import { THREE } from 'aframe';
// import { rayIntersectionData } from '@/composables/oculusSimulator';

const props = defineProps<{
  intersection?: THREE.Vector3
  active: boolean
}>();

const emit = defineEmits<{
  update: [active: boolean, position?: THREE.Vector3]
}>();

// watch(() => props.intersection, (value) => {
//   if(!value) { return }
//   if(!props.active) { return }
//   emitUpdate()
// });
// watch(() => rayIntersectionData.value?.intersection, (value) => {
//   if (!value) { return; }
//   if (!props.active) { return; }
//   emitUpdate();
// });

watch([() => props.active, () => props.intersection], () => {
  emitUpdate();
});

function emitUpdate() {
  // emit('update', props.active, rayIntersectionData.value?.intersection.point);
  emit('update', props.active, toValue(props.intersection));
}

</script>

<template>
  <!-- <a-entity :position="$props.intersection"> -->
  <a-entity>
    <!-- TODO: Should a-frame entities perhaps not be updated like below, using dynamic values? -->
    <a-box id="laserPoint" scale=".075 .075 .075" :color="$props.active ? 'green' : 'white'" />
  </a-entity>
</template>
