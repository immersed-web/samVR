<template>
  <a-entity>
    <a-image @materialtextureloaded="onTextureLoaded" v-if="tagName === 'a-image'" :class="$attrs.class" :src="src" />
    <PdfEntity v-else-if="tagName === 'PdfEntity'" :src="src" :class="$attrs.class" />
    <component v-else :is="tagName" :src="src" :class="$attrs.class" />
  </a-entity>
</template>
<script setup lang="ts">
import { getAssetUrl } from '@/modules/utils';
import type { ComponentDefinition, ComponentDescriptor, DetailEvent, THREE, components } from 'aframe';
import { extensionsToAframeTagsMap, type Asset } from 'schemas';
import { computed } from 'vue';
import PdfEntity from './PdfEntity.vue';


function onTextureLoaded(event: DetailEvent<{ src: HTMLImageElement, texture: THREE.Texture }>) {
  // console.log(event);
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