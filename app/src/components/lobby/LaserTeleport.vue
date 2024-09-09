<script setup lang="ts">
import { ref, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useCurrentCursorIntersection } from '@/composables/vrSpaceComposables';

const vrSpaceStore = useVrSpaceStore();
const { currentCursor } = useCurrentCursorIntersection();

const laserActive = ref(false);

useEventListener(window, 'keydown', (event) => {
  if (event.isComposing || event.key === 'l') {
    toggleLaser();
  }
});

function toggleLaser() {
  laserActive.value = !laserActive.value;
}

watch([laserActive, currentCursor], ([newActive, newIntersection], [oldActive, oldIntersection]) => {
  if (newActive) {
    if (!newIntersection) {
      console.warn('laser intersection was undefined while marked as active');
      return;
    }
    console.log('laser updated', newIntersection);
    const rayDirection = newIntersection.rayDirection
    console.log('rayDirection', rayDirection);
    vrSpaceStore.ownClientTransform.laserPointer = { active: newActive, position: newIntersection.intersection.point.toArray(), directionVector: rayDirection.toArray() };
  } else if (!newActive && oldActive !== newActive) {
    vrSpaceStore.ownClientTransform.laserPointer = { active: false };
  }
});

</script>

<template>
  <!-- Laser pointer, self -->
  <Teleport to="#teleport-target-aframe-cursor">
    <a-sphere v-if="laserActive" scale=".075 .075 .075" color="green" />
  </Teleport>

  <!-- For optimization, other avatars' laser pointers are rendered directly in the remote avatar iteration -->

  <!-- UI, clickable badge -->
  <Teleport to="#teleport-target-ui-left">
    <div class="badge cursor-pointer pointer-events-auto tooltip tooltip-right"
      :class="laserActive ? 'badge-success' : ''" @click="toggleLaser"
      data-tip="Klicka eller tryck L för att slå på och av laserpekaren">
      Laserpekaren är {{ laserActive ? 'på' : 'av' }}
    </div>
  </Teleport>
</template>
