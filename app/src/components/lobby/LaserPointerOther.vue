<script setup lang="ts">

defineProps<{
  position: readonly [number, number, number]
  positionSource: readonly [number, number, number]
}>();

</script>

<template>
  <a-entity
    :line="'start: ' + $props.positionSource.join(' ') + '; end: ' + $props.position.join(' ') + '; color: red;'" />
  <a-sphere :position="$props.position.join(' ')" scale=".05 .05 .05" color="red" />
</template>
