<template>
  <a-entity>
    <a-troika-text v-if="props.label" look-at-camera :value="props.label" position="0 2.2 0" />
    <a-troika-text transparent="true" fill-opacity="0.4" font-size="1.1" v-if="!allowed" look-at-camera color="red"
      value="block" font="#icon-font" position="0 1.5 0" />

    <a-sphere
      animation__hover="property: scale; startEvents: mouseenter; easing: easeInOutCubic; dur: 150; from: 0.5 0.5 0.5; to: 0.7 0.7 0.7"
      animation__leave="property: scale; startEvents: mouseleave; easing: easeInOutCubic; dur: 150; from: 0.7 0.7 0.7; to: 0.5 0.5 0.5"
      @click.stop="emit('click', $event)" :class="[(props.clickable && allowed) ? 'clickable' : '']" transparent="true"
      scale="0.5 0.5 0.5" :opacity="allowed ? 1.0 : 0.5" material="shader: outer-glow; start: 0.3; color: 0.5 0 1;"
      position="0 1.5 0">
      <a-icosahedron v-if="panoramicPreviewUrl" detail="5" scale="0.98 0.98 0.98" transparent="true"
        :opacity="allowed ? 1.0 : 0.2"
        :material="`shader: pano-portal; dynamicOpacity: true; warpParams: 2.8 0.5; src: ${panoramicPreviewUrl}; side:back;`">
      </a-icosahedron>
      <a-sphere v-else color="black" transparent="true" opacity="0.9" scale="0.98 0.98 0.98" />
    </a-sphere>
  </a-entity>
</template>
<script setup lang="ts">
import { getAssetUrl } from '@/modules/utils';
import type { THREE } from 'aframe';
import type { PlacedObjectWithIncludes } from 'database';
import { computed, type DeepReadonly } from 'vue';
import { useClientStore } from '@/stores/clientStore';
const clientStore = useClientStore();

type VrPortalData = PlacedObjectWithIncludes['vrPortal'];
const props = withDefaults(defineProps<{
  // panoramicPreviewUrl?: string
  label?: string
  clickable?: boolean
  vrPortal: DeepReadonly<VrPortalData>
}>(), {
  clickable: true
});

const panoramicPreviewUrl = computed(() => {
  if (!props.vrPortal?.panoramicPreview) return undefined;
  return getAssetUrl(props.vrPortal.panoramicPreview.generatedName);
});

const allowed = computed(() => {
  if (!props.vrPortal) return false
  const portalInfo = props.vrPortal;
  const isPubliclyAvailable = portalInfo.visibility === 'public' || portalInfo.visibility === 'unlisted';
  const isOwner = portalInfo.owner.userId === clientStore.clientState?.userId
  const isAllowed = portalInfo.allowedUsers.some(u => u.userId === clientStore.clientState?.userId)
  return isOwner || isAllowed || isPubliclyAvailable;
})

const emit = defineEmits<{
  click: [point: THREE.Vector3Tuple]
}>();
</script>