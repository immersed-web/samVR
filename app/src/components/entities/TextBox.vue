<template>
  <a-entity
    :class="$attrs.class"
    :scale="entityScale"
    @click.stop="$emit('click')"
  >
    <a-plane
      position="0 0 0.01"
      width="2.4"
      height="0.9"
      material="color: #ffffff; opacity: 0.001; transparent: true; side: double"
    />
    <a-troika-text
      :value="text"
      :font-size="fontSize"
      :color="color"
      align="center"
      anchor="center"
      baseline="middle"
      :max-width="maxWidth"
      position="0 0 0.02"
    />
  </a-entity>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { arrToCoordString, quaternionTupleToAframeRotation } from '@/modules/3DUtils'

const props = defineProps<{
  placedObject: any
}>()

defineEmits<{
  (e: 'click'): void
}>()

const textSettings = computed(() => props.placedObject.objectSettings ?? {})

const text = computed(() => textSettings.value.text ?? 'Ny textbox')
const fontSize = computed(() => textSettings.value.fontSize ?? 0.8)
const color = computed(() => textSettings.value.color ?? '#ffffff')
const maxWidth = computed(() => textSettings.value.maxWidth ?? 4)

const entityScale = computed(() => arrToCoordString(props.placedObject.scale ?? [1, 1, 1]))
</script>