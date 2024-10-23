<script setup lang="ts">
import { overlayGUILeft, overlayGUICenter, overlayGUIRight } from '@/composables/teleportTargets';
</script>

<template>
  <div id="ui" class="absolute top-0 left-0 z-10 flex justify-between p-2 pointer-events-none w-svw h-svh">
    <div ref="overlayGUILeft" class=" flex flex-col gap-1">
      <slot name="left" />
    </div>
    <div ref="overlayGUICenter" class="">
      <slot name="center" />
    </div>
    <div ref="overlayGUIRight" class="flex flex-col gap-1">
      <slot name="right" />
    </div>
  </div>
</template>

<style scoped>
#ui {
  /* position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10;
    */
    /* pointer-events: none; */
}

#ui>div * {
  /* display: inline-block; */
  /* pointer-events: all; */
}
</style>
