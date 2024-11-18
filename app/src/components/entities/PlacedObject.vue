<template>
  <a-entity :rotation="rotationString" :position="positionString">
    <!-- <slot /> -->
    <VrSpacePortal v-if="placedObject.type === 'vrPortal'" :vr-portal="placedObject.vrPortal"
      @click.stop="router.replace({ name: 'vrSpace', params: { vrSpaceId: placedObject.vrPortal?.vrSpaceId } })"
      :label="placedObject.vrPortal?.name" />
    <PlacedAsset class="raycastable-surface" v-else-if="placedObject.type === 'asset' && placedObject.asset"
      :scale="scaleString" :asset="placedObject.asset" />
  </a-entity>
</template>

<script setup lang="ts">
import { arrToCoordString, quaternionTupleToAframeRotation } from '@/modules/3DUtils';
import VrSpacePortal from '../entities/VrSpacePortal.vue';
import PlacedAsset from '@/components/entities/PlacedAsset.vue';
import type { PlacedObjectWithIncludes } from 'database';
import { computed, onMounted, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import type { Entity } from 'aframe';
const router = useRouter();

const { placedObject } = defineProps<{
  placedObject: PlacedObjectWithIncludes
}>()

const rotationString = computed(() => {
  if (!placedObject.orientation) {
    console.warn('placedObject orientation was undefined');
    return "0 0 0";
  }
  return arrToCoordString(quaternionTupleToAframeRotation(placedObject.orientation ?? [0, 0, 0, 1]))
})

const positionString = computed(() => {
  if (!placedObject.position) {
    console.warn('placedObject position was undefined');
    return "0 0 0";
  }
  return arrToCoordString(placedObject.position)
})

const scaleString = computed(() => {
  if (!placedObject.scale) {
    if (placedObject.type === 'asset') {
      console.warn('placedObject of types asset scale was undefined defaulting to [1 1 1]');
    }
    return "1 1 1";
  }
  return arrToCoordString(placedObject.scale)
})

onMounted(() => {
  // console.log('PlacedObject mounted:', placedObject);

  // entityTag.value?.addEventListener('loaded', (e) => {
  //   console.log('placedobject entity loaded:', e);
  //   console.log('placedObject matrixworld:', entityTag.value?.object3D.matrixWorld.elements[0]);
  // })
})

</script>