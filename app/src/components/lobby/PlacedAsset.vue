<template>
  <a-entity>
    <component :is="tagName" :src="src" />
  </a-entity>
</template>
<script setup lang="ts">
import { getAssetUrl } from '@/modules/utils';
import { extensionsToAframeTagsMap, type Asset } from 'schemas';
import { computed } from 'vue';



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