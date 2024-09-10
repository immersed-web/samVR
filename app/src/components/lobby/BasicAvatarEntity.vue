<template>

  <a-entity interpolated-transform="interpolationTime: 350;" ref="avatarEntity" @loaded="onAvatarEntityLoaded">
    <!-- <Teleport to="#teleport-target-ui-right">
      <div>{{ realTimeData }}</div>
    </Teleport> -->
    <slot />
    <a-entity rotation="0 180 0">
      <a-entity position="0 0 0">
        <AvatarPart v-for="(part, key) in headGroupedParts" :key="key" :part-name="key" :part="part" />
        <AvatarSkinPart skin-part-name="heads" :part="avatarDesign.parts.heads" :skin-color="avatarDesign.skinColor" />
        <a-entity position="0 0 0" class="audio-level">
          <AvatarPart part-name="mouths" :part="avatarDesign.parts.mouths" />
        </a-entity>
        <!-- <a-entity :gltf-model="`url(/avatar/mouths/${avatarDesign.parts.mouths.model}.glb)`" /> -->
      </a-entity>
      <a-entity ref="lowerBodyTag" lock-rotation-axis>
        <AvatarSkinPart skin-part-name="torsos" :part="avatarDesign.parts.torsos"
          :skin-color="avatarDesign.skinColor" />
        <AvatarPart part-name="clothes" :part="avatarDesign.parts.clothes" />
        <AvatarPart part-name="layer" :part="avatarDesign.parts.layer" />
      </a-entity>
    </a-entity>
  </a-entity>
</template>

<script setup lang="ts">

import type { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { Entity } from 'aframe';
import { skinParts as skinPartArray, type SkinPart, type ActiveTransform, type AvatarDesign, type ClientRealtimeData, type ConnectionId } from 'schemas'
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import AvatarPart from './AvatarPart.vue';
import AvatarSkinPart from './AvatarSkinPart.vue';
import { omit, pick } from 'lodash-es';

const props = defineProps<{
  // realTimeData: Readonly<ClientRealtimeData>
  avatarDesign: NonNullable<NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]['avatarDesign']>
  // avatarDesign: AvatarDesign
  realTimeData: NonNullable<NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]['transform']>
}>();

// const skinParts = computed(() => {
//   return pick(props.avatarDesign.parts, skinPartArray)
// });

const headGroupedParts = computed(() => {
  const omittedParts = ['layer', 'clothes', 'mouths', ...skinPartArray] as const;
  return omit(props.avatarDesign.parts, omittedParts);
})

const avatarEntity = ref<Entity>();

async function onAvatarEntityLoaded() {
  console.log('avatar a-entity loaded!');
  if (!avatarEntity.value) {
    console.error('avatarEntity was undefined');
    return;
  }
  if (props.realTimeData.head.active) {
    // NOTE: For some reason the event isnt received by interpolated-transform if we dont put it on the event queue.
    // I guess there is something that makes the entity trigger the loaded event before it is _actually_ fully ready.
    await new Promise(res => setTimeout(res, 0));
    console.log('avatarentity: setting head transform', props.realTimeData.head);
    avatarEntity.value.emit('setTransform', props.realTimeData.head);
  }
  // if (!stream.value) {
  //   console.log('stream is undefined. Will not emit');
  //   return;
  // }
  // console.log('emitting mediastream to entity after avatar entity loaded', stream.value);
  // avatarEntity.value.emit('setMediaStream', { stream: stream.value });
}

watch(() => props.realTimeData.head, (headTransform) => {
  if (!headTransform.active) return;
  // console.log('updating head', headTransform.position);
  avatarEntity.value?.emit('moveTo', { position: headTransform.position }, false);
  avatarEntity.value?.emit('rotateTo', { rotation: headTransform.rotation }, false);
}, { immediate: true });

</script>