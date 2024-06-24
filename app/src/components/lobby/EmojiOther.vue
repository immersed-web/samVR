<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { type Entity} from 'aframe';

type Tuple = [number, number]

const props = defineProps<{
  sheetUrl: string,
  coords?: Tuple,
  active: boolean
}>()

const emoji = ref<Entity>()

watch(() => props.active, (value) => {
  if(value){
    emoji.value?.emit('show', null, false);
  }
  else{
    emoji.value?.emit('hide', null, false);
  }
})

</script>

<template>
  <a-entity ref="emoji" position="0 1.5 0" look-at="[camera]" scale="0 0 0" animation__show="property: scale; to: 1 1 1; dur: 1000; easing: easeOutQuad; startEvents: show" animation__hide="property: scale; to: 0 0 0; dur: 1000; easing: easeInQuad; startEvents: hide" >
    <a-entity v-if="$props.coords" rotation="0 0 -5" animation="property: rotation; to: 0 0 5; loop: true; dir: alternate; dur: 1000; easing: easeInOutQuad">
      <a-entity
        position="0 0.5 0"
        :atlas-uvs="'totalRows: 43; totalColumns: 43; column: ' + $props.coords[0] + '; row: '+ $props.coords[1] +';'"
        :material="`src: ${sheetUrl}; transparent: true; shader: flat;`"
        geometry="primitive: plane; width: 0.4; height: 0.4; buffer: true; skipCache: true" />
    </a-entity>
  </a-entity>
</template>