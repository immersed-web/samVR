<template>
  <a-entity>
    <!-- <a-sphere :class="$attrs.class" color="yellow" scale="0.2 0.2 0.2" /> -->
    <a-image @materialtextureloaded="onTextureLoaded" v-if="tagName === 'a-image'" :class="$attrs.class" :src="src" />
    <PdfEntity v-else-if="tagName === 'PdfEntity'" v-model:current-page="currentPage" :src="src"
      :class="$attrs.class" />
    <component rotation="90 0 0" v-else :is="tagName" :src="src" :class="$attrs.class" />
  </a-entity>
</template>
<script setup lang="ts">
import { getAssetUrl } from '@/modules/utils';
import type { ComponentDefinition, ComponentDescriptor, DetailEvent, THREE, components } from 'aframe';
import { extensionsToAframeTagsMap, type Asset } from 'schemas';
import { computed, onMounted, onUnmounted, onUpdated, ref, useAttrs } from 'vue';
import PdfEntity from './PdfEntity.vue';
const attrs = useAttrs();

onUpdated(() => {
  // console.log('PlacedAsset updated');
})
onMounted(() => {
  console.log('PlacedAsset mounted');
  console.log('attrs:', attrs);
  console.log('props:', props);
})
onUnmounted(() => {
  console.log('PlacedAsset unmounted');
})

const currentPage = ref(1);

function onTextureLoaded(event: DetailEvent<{ src: HTMLImageElement, texture: THREE.Texture }>) {
  console.log('texture loaded');
  const aImageTag = event.target;
  const { width, height } = event.detail.src
  const ratio = width / height;
  aImageTag.object3D.scale.set(ratio, 1, 1);
  return
}

const tagName = computed(() => {
  return extensionsToAframeTagsMap[props.asset.assetFileExtension];
})

const src = computed(() => {
  return getAssetUrl(props.asset.generatedName);
})

const props = defineProps<{
  asset: Asset
}>();


</script>