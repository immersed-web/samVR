<script setup lang="ts">
import { computed } from 'vue';


type Tuple = [number, number]

const props = defineProps<{
  sheetUrl: string,
  uvs: Tuple,
  coords: Tuple
}>();

// const atlasDimensions = reactive({
//   width: 0,
//   height: 0,
// });

// const imgSizeAttr = computed(() => ({
//   width: atlasDimensions.width / props.uvs[0],
//   height: atlasDimensions.height / props.uvs[1],
// }))
// function onImgLoaded() {
//   if (!imgTag.value) return;
//   atlasDimensions.width = imgTag.value.naturalWidth;
//   atlasDimensions.height = imgTag.value.naturalHeight;
// }

const spriteStyle = computed(() => {
  // const w = atlasDimensions.width / props.uvs[0];
  // const h = atlasDimensions.height / props.uvs[1];
  const normalizedSpriteWidth = 1 / (props.uvs[0] - 1);
  const normalizedSpriteHeight = 1 / (props.uvs[1] - 1);
  //origo is left-bottom... 
  // index starts at 1!! sigh... 
  const x = (props.coords[0] - 1) * normalizedSpriteWidth * 100;
  const y = (props.coords[1] - 1) * normalizedSpriteHeight * 100;

  const backgroundScaleFactor = props.uvs[0] * 100;
  const styleObject = {
    backgroundImage: `url(${props.sheetUrl})`,
    backgroundPosition: `left ${x}% bottom ${y}%`,
    backgroundSize: `${backgroundScaleFactor}%`

    // objectFit: 'none',
    // objectPosition: `${x}% ${y}%`,
    // width: `${w}px`,
    // height: `${h}px`,
  }
  console.log(styleObject);
  return styleObject;
})

</script>

<template>
  <div class="aspect-square" :style="spriteStyle" :src="sheetUrl" />
</template>

<style scoped></style>
