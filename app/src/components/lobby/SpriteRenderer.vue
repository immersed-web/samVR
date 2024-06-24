<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

type Tuple = [number, number]

const props = defineProps<{
  sheetUrl: string,
  uvs: Tuple,
  coords: Tuple
}>();

const canvas = ref<HTMLCanvasElement>();

function drawSprite() {
  const ctx = canvas.value?.getContext('2d');
  const image = new Image();
  image.src = props.sheetUrl;
  image.addEventListener('load', () => {
    if (canvas.value) {
      ctx?.clearRect(0, 0, canvas.value.width, canvas.value.height);
      const spriteWidth = image.width / props.uvs[0];
      const spriteHeight = image.height / props.uvs[1];
      ctx?.drawImage(image, (props.coords[0] - 1) * spriteWidth, image.height - props.coords[1] * spriteHeight, spriteWidth, spriteHeight, 0, 0, canvas.value.width, canvas.value.height);
    }
  });
}

onMounted(() => {
  drawSprite();
});

watch(() => props.coords, () => {
  drawSprite();
});

</script>

<template>
  <canvas ref="canvas" />
</template>

<style scoped>
canvas {
  width: 100%;
  height: 100%;
}
</style>
