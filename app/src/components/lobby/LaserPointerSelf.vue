<script setup lang="ts">
import { ref, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { useCurrentCursorIntersection } from '@/composables/vrSpaceComposables';

const vrSpaceStore = useVrSpaceStore()
const { currentCursor } = useCurrentCursorIntersection();

const laserActive = ref(false);

useEventListener(window, 'keydown', (event) => {
  if (event.isComposing || event.key === 'l') {
    laserActive.value = !laserActive.value;
  }
})

watch([laserActive, currentCursor], ([newActive, newIntersection], [oldActive, oldIntersection]) => {
  if (newActive) {
    if (!newIntersection) {
      console.error('laser intersection was undefined while marked as active');
      return;
    }
    vrSpaceStore.ownClientTransform.laserPointer = { active: newActive, position: newIntersection.intersection.point.toArray() };
  } else if (!newActive && oldActive !== newActive) {
    vrSpaceStore.ownClientTransform.laserPointer = { active: newActive };
  }
});

</script>

<template>
  <a-entity>
    <a-box id="laserPoint" scale=".075 .075 .075" :color="laserActive ? 'green' : 'white'" />
  </a-entity>
</template>
