<template>
  <a-entity>
    <a-troika-text v-if="props.label" look-at-camera :value="props.label" position="0 2.5 0" />
    <a-sphere
      animation__hover="property: scale; startEvents: mouseenter; easing: easeInCubic; dur: 150; from: 0.5 0.5 0.5; to: 0.7 0.7 0.7"
      animation__leave="property: scale; startEvents: mouseleave; easing: easeInCubic; dur: 150; from: 0.7 0.7 0.7; to: 0.5 0.5 0.5"
      @click="emit('click', $event)" :class="[props.clickable ? 'clickable' : '']" transparent="true"
      scale="0.5 0.5 0.5" material="shader: outer-glow; start: 0.3; color: 0.5 0 1;" position="0 1.5 0">
      <a-icosahedron v-if="props.panoramicPreviewUrl" detail="5" scale="0.98 0.98 0.98" transparent="true"
        opacity="0.95"
        :material="`shader: pano-portal; warpParams: 3 0.9; src: ${props.panoramicPreviewUrl}; side:back;`">
      </a-icosahedron>
      <a-sphere v-else color="black" transparent="true" opacity="0.9" scale="0.98 0.98 0.98" />
    </a-sphere>
  </a-entity>
</template>
<script setup lang="ts">
import type { THREE } from 'aframe';

const props = withDefaults(defineProps<{
  panoramicPreviewUrl?: string
  label?: string
  clickable?: boolean
}>(), {
  clickable: true
});

const emit = defineEmits<{
  click: [point: THREE.Vector3Tuple]
}>();
</script>