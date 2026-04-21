<template>
  <a-entity
    :position="positionString"
    :rotation="rotationString"
    :scale="scaleString"
    class="raycastable-surface selectable-object editable-object"
    @click.stop="$emit('select', props.placedObject)"
  >
    <a-troika-text
      v-if="textSettings"
      :value="textSettings.text ?? ''"
      :color="textSettings.color ?? '#000000'"
      :font-size="textSettings.fontSize ?? 0.5"
      :outline-color="textSettings.outlineColor ?? '#ffffff'"
      :outline-width="textSettings.outlineWidth ?? 0.02"
      align="center"
      anchor="center"
      baseline="center"
      :max-width="textSettings.maxWidth ?? 4"
    />
  </a-entity>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { arrToCoordString, quaternionTupleToAframeRotation } from '@/modules/3DUtils';
import type { PlacedObjectWithIncludes } from 'database';

interface TextSettings {
  text: string;
  color?: string;
  fontSize?: number;
  outlineColor?: string;
  outlineWidth?: number;
  maxWidth?: number;
}

const props = defineProps<{
  placedObject: PlacedObjectWithIncludes;
}>();

const emit = defineEmits<{
  select: [PlacedObjectWithIncludes];
}>();

const positionString = computed(() => arrToCoordString(props.placedObject.position));
const rotationString = computed(() => arrToCoordString(quaternionTupleToAframeRotation(props.placedObject.orientation ?? [0, 0, 0, 1])));
const scaleString = computed(() => arrToCoordString(props.placedObject.scale ?? [1, 1, 1]));

const textSettings = computed(() => {
  if (props.placedObject.type !== 'text') return null;
  return props.placedObject.objectSettings as TextSettings | null;
});
</script>