<script setup lang="ts">
import { type Ref, ref, computed } from 'vue';
import { type DetailEvent, THREE, type Scene } from 'aframe';
// import { useXRState } from '@/composables/XRState';
import { useCurrentCursorIntersection } from '@/composables/vrSpaceComposables';

// const { isImmersed } = useXRState();
const { currentCursor } = useCurrentCursorIntersection();

import LaserPointerSelf from '@/components/lobby/LaserPointerSelf.vue';
import LaserPointerOther from '@/components/lobby/LaserPointerOther.vue';

const laserActive = ref(false);
const otherPosition: Ref<THREE.Vector3 | undefined> = ref(undefined);

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
    <LaserPointerSelf :active="laserActive" :intersection="currentCursor?.intersection.point" @update="laserUpdate" />
  </Teleport>

  <Teleport to="#tp-aframe-scene">
    <!-- Show active laser pointers from other users -->
    <!-- Render as a red sphere -->
    <LaserPointerOther :point="otherPosition" />
  </Teleport>

  <!-- <a-entity v-if="isImmersed">
    <a-entity laser-controls="hand: right" raycaster="objects: .clickable" raycaster-update
      @raycast-update="setIntersection" />
    <a-entity oculus-touch-controls="hand: right" laser-pointer
      @laser-active-toggle="setLaserActiveByOculusHandControl" />
  </a-entity> -->
</template>

<style scoped></style>
