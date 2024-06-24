<script setup lang="ts">
import { type Ref, ref } from 'vue';
import { type DetailEvent, THREE, type Scene } from 'aframe';
import { isVR } from '@/composables/lobbyUtils';

import LaserPointerSelf from '@/components/lobby/LaserPointerSelf.vue';
import LaserPointerOther from '@/components/lobby/LaserPointerOther.vue';

const laserActive = ref(false);
const cursorIntersection: Ref<THREE.Vector3> = ref(new THREE.Vector3());
const otherPosition: Ref<THREE.Vector3 | undefined> = ref(undefined);

function setIntersection(evt: DetailEvent<{ intersection: THREE.Intersection }>) {
  cursorIntersection.value = evt.detail.intersection.point;
}

function setLaserActiveByOculusHandControl(evt: DetailEvent<{ value: boolean }>) {
  laserActive.value = evt.detail.value;
}

window.addEventListener('keydown', (event) => {
  if (event.isComposing || event.key === 'l') {
    laserActive.value = !laserActive.value;
  }
});

function laserUpdate(active: boolean, position?: THREE.Vector3) {
  // console.log("Laser update", active, position)
  otherPosition.value = active ? position : undefined;
}

</script>

<template>
  <!-- Raycast and emit intersection points for own cursor / hand control -->
  <!-- Render as a white (inactive) or green (active) cube -->
  <Teleport to="#tp-aframe-cursor">
    <LaserPointerSelf :active="laserActive" :intersection="cursorIntersection" @update="laserUpdate" />
  </Teleport>

  <Teleport to="#tp-aframe-scene">
    <!-- Show active laser pointers from other users -->
    <!-- Render as a red sphere -->
    <LaserPointerOther :point="otherPosition" />
  </Teleport>

  <a-entity v-if="isVR">
    <a-entity laser-controls="hand: right" raycaster="objects: .clickable" raycaster-update
      @raycast-update="setIntersection" />
    <a-entity oculus-touch-controls="hand: right" laser-pointer
      @laser-active-toggle="setLaserActiveByOculusHandControl" />
  </a-entity>
</template>

<style scoped></style>
