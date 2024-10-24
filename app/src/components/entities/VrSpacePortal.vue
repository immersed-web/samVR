<template>
  <a-entity v-bind="attrsWithoutClass">
    <a-troika-text v-if="props.label" look-at-camera :value="props.label"
      :position="`0 ${defaultHeightOverGround + 0.5 + 0.3} 0`" />
    <!-- <a-troika-text look-at-camera :value="vrPortal?.vrSpaceId" position="0 2.5 0" />
    <a-troika-text look-at-camera :value="vrPortal?.panoramicPreview?.originalFileName" position="0 2.8 0" /> -->

    <a-troika-text v-if="!allowed" transparent="true" fill-opacity="0.4" font-size="1.1" look-at-camera color="red"
      value="block" font="#icon-font" :position="`0 ${defaultHeightOverGround} 0`" />

    <a-sphere v-bind="animationAttributes" :class="[{ 'clickable': (props.clickable && allowed) }, $attrs.class]"
      transparent="true" scale="0.5 0.5 0.5" :opacity="allowed ? 1.0 : 0.5"
      material="shader: outer-glow; start: 0.3; color: 0.5 0 1;" :position="`0 ${defaultHeightOverGround} 0`"
      :box-helper="`enabled: ${showBoxHelper}`">
      <a-icosahedron
        :material="`shader: pano-portal; dynamicOpacity: true; warpParams: 2.8 0.5; src: url(${panoramicPreviewUrl}); side: back;`"
        v-if="panoramicPreviewUrl" detail="5" scale="0.98 0.98 0.98" transparent="true" :opacity="allowed ? 1.0 : 0.2">
      </a-icosahedron>
      <a-sphere v-else color="black" transparent="true" opacity="0.9" scale="0.98 0.98 0.98" />
      <a-sphere transparent="true" scale="0.97 0.97 0.97" :opacity="allowed ? 1.0 : 0.5"
        material="shader: outer-glow; start: 0.3; color: 0.5 0 1; side:back" />
    </a-sphere>
  </a-entity>
</template>
<script setup lang="ts">
import { getAssetUrl } from '@/modules/utils';
// import type { THREE } from 'aframe';
import type { PlacedObjectWithIncludes } from 'database';
import { computed, type DeepReadonly, nextTick, onMounted, onUnmounted, onUpdated, ref, useAttrs, watch } from 'vue';
import { useClientStore } from '@/stores/clientStore';
import { omit } from 'lodash-es';
import type { Entity } from 'aframe';
import { defaultHeightOverGround } from 'schemas';
const clientStore = useClientStore();
const attrs = useAttrs();

const attrsWithoutClass = computed(() => omit(attrs, 'class'));

const animationAttributes = computed(() => {
  if (!allowed.value) return {};
  return {
    animation__hover: "property: scale; startEvents: mouseenter; easing: easeInOutCubic; dur: 90; from: 0.5 0.5 0.5; to: 0.57 0.57 0.57",
    animation__leave: "property: scale; startEvents: mouseleave; easing: easeInOutCubic; dur: 90; from: 0.57 0.57 0.57; to: 0.5 0.5 0.5"
  }
})

const portalTagRef = ref<Entity>()
onUpdated(() => {
  // console.log('VrSpacePortal updated');
})
onMounted(() => {
  console.log('VrSpacePortal mounted');
})
onUnmounted(() => {
  console.log('VrSpacePortal unmounted');
})

defineOptions({
  inheritAttrs: false,
})

type VrPortalData = PlacedObjectWithIncludes['vrPortal'];
const props = withDefaults(defineProps<{
  // panoramicPreviewUrl?: string
  showBoxHelper?: boolean
  label?: string
  clickable?: boolean
  vrPortal: DeepReadonly<VrPortalData>
}>(), {
  clickable: true,
  showBoxHelper: false,
});

const panoramicPreviewUrl = computed(() => {
  if (!props.vrPortal?.panoramicPreview) {
    return undefined;
  }
  return getAssetUrl(props.vrPortal.panoramicPreview.generatedName);
});

// watch(() => props.vrPortal?.panoramicPreview, (panoPreview) => {
//   if (!panoPreview) {
//     portalTagRef.value?.removeAttribute('material')
//     console.log('pano shader removed');
//   } else {
//     const url = getAssetUrl(panoPreview.generatedName);
//     setPanoshader(url);
//   }
// })

async function setPanoshader(url: string) {
  // const url = getAssetUrl(panoPreview.generatedName);
  portalTagRef.value?.removeAttribute('material');
  await nextTick();
  // EXTREMELY PECULIAR WHY WE NEED TO WRAP THIS IN A timeout
  // setTimeout(() => {
    const opacity = allowed.value ? 1.0 : 0.2;
    portalTagRef.value?.setAttribute('material', `shader: pano-portal;transparent: true; dynamicOpacity: true; opacity: ${opacity}; warpParams: 2.8 0.5; src: url(${url}); side:back;`);
    // console.log(`pano shader set with url: ${url}`);
  // }, 1);
}

onMounted(() => {
  // console.log('portalTagRef: ', portalTagRef.value);
  // console.log('portal mounted');
  // if (props.vrPortal?.panoramicPreview) {
  //   const url = getAssetUrl(props.vrPortal.panoramicPreview.generatedName);
  //   setPanoshader(url);
  // }
});

const allowed = computed(() => {
  if (!props.vrPortal) return false
  const portalInfo = props.vrPortal;
  const isPubliclyAvailable = portalInfo.visibility === 'public' || portalInfo.visibility === 'unlisted';
  const isOwner = portalInfo.owner.userId === clientStore.clientState?.userId
  const isAllowed = portalInfo.allowedUsers.some(u => u.userId === clientStore.clientState?.userId)
  return isOwner || isAllowed || isPubliclyAvailable;
})

</script>