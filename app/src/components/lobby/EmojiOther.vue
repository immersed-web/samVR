<script setup lang="ts">
import { computed, ref, Ref, watch } from 'vue';
import { type Entity} from 'aframe';
import emojiSheet from '@/assets/sprite-128.png';
import { number } from 'zod';

const props = defineProps<{
  active?: boolean,
  coords?: readonly [number, number],
}>();

const emoji = ref<Entity>();

watch(() => props.active, (newActive) => {
  if (newActive) {
    console.log('Show emoji', props.coords);
    emoji.value?.emit('show', null, false);
  }
  else {
    emoji.value?.emit('hide', null, false);
    console.log('Hide emoji');
  }
});

const coordsSaved: Ref<readonly [number, number] | undefined> = ref(undefined);
watch(() => props.coords, (newCoords) => {
  if (newCoords) {
    coordsSaved.value = props.coords;
  }
});

</script>

<template>
  <a-entity ref="emoji" position="0 0.5 0" look-at-camera scale="0 0 0"
    animation__show="property: scale; to: 1 1 1; dur: 1000; easing: easeOutQuad; startEvents: show"
    animation__hide="property: scale; to: 0 0 0; dur: 1000; easing: easeInQuad; startEvents: hide">
    <a-entity v-if="coordsSaved" rotation="0 0 -5"
      animation="property: rotation; to: 0 0 5; loop: true; dir: alternate; dur: 1000; easing: easeInOutQuad">
      <a-entity position="0 0.5 0"
        :atlas-uvs="'totalRows: 43; totalColumns: 43; column: ' + coordsSaved[0] + '; row: ' + coordsSaved[1] + ';'"
        :material="`src: ${emojiSheet}; transparent: true; shader: flat;`"
        geometry="primitive: plane; width: 0.4; height: 0.4; buffer: true; skipCache: true" />
    </a-entity>
  </a-entity>
</template>

