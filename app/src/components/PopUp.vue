<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { vOnClickOutside } from '@vueuse/components'

const popup = ref<HTMLDivElement | null>(null)

const isOpen = ref(false)

const position = ref(['',''])

const open = (evt: Event) => {
  isOpen.value = true;
  const rect = (evt.target as HTMLElement).getBoundingClientRect()
  position.value[0] = rect.x + 'px'
  position.value[1] = (rect.y + rect.height) + 'px' 
}

const close = () => {
  isOpen.value = false;
}

const toggle = (evt: Event) => {
  if(!isOpen.value){
    open(evt);
  }
  else{
    close(evt);
  }
}

onMounted(() => {
  console.log("Previous sibling", popup.value?.previousElementSibling)
})

defineExpose({
  open,
  close,
  toggle
});

</script>

<template>
  <div id="popup" ref="popup" :style="{'left': position[0], 'top': position[1]}" v-on-click-outside="close">
    <slot v-if="isOpen"></slot>
    <!-- <div id="background" @click="close"></div> -->
  </div>
</template>

<style scoped>
#background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2;
  background-color: "red";
}

#popup {
  position: fixed;
  top: 100px;
  left: 100px;
  z-index: 3;
}
</style>
