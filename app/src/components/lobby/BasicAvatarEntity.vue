<template>

  <a-entity interpolated-transform="interpolationTime: 350;" ref="avatarEntity" @loaded="onAvatarEntityLoaded">
    <!-- <Teleport to="#teleport-target-ui-right">
      <div>{{ realTimeData }}</div>
    </Teleport> -->
    <slot />
    <a-entity rotation="0 180 0">
      <a-entity position="0 0 0">
        <a-entity :gltf-model="`url(/avatar/hair/${avatarDesign.parts.hair.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/heads/${avatarDesign.parts.heads.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/eyes/${avatarDesign.parts.eyes.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/eyebrows/${avatarDesign.parts.eyebrows.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/accessories/${avatarDesign.parts.accessories.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/facialhair/${avatarDesign.parts.facialhair.model}.glb)`" />
        <!-- <a-entity position="0 -0.05 0" class="audio-level">
          <a-entity position="0 0.05 0.002" gltf-model="#avatar-mouth-1" />
        </a-entity> -->
        <a-entity :gltf-model="`url(/avatar/mouths/${avatarDesign.parts.mouths.model}.glb)`" />
      </a-entity>
      <a-entity ref="lowerBodyTag" lock-rotation-axis>
        <a-entity :gltf-model="`url(/avatar/torsos/${avatarDesign.parts.torsos.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/clothes/${avatarDesign.parts.clothes.model}.glb)`" />
      </a-entity>
      <!-- <a-sphere color="blue" scale="0.2 0.2 0.2" /> -->
    </a-entity>
  </a-entity>
</template>

<script setup lang="ts">

import type { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { Entity } from 'aframe';
import type { ActiveTransform, AvatarDesign, ClientRealtimeData, ConnectionId } from 'schemas'
import { onBeforeMount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  // realTimeData: Readonly<ClientRealtimeData>
  avatarDesign: NonNullable<NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]['avatarDesign']>
  // avatarDesign: AvatarDesign
  realTimeData: NonNullable<NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]['transform']>
}>();

const avatarEntity = ref<Entity>();

// onBeforeMount(() => {
//   console.log('BasicAvatatEntity onBeforeMount');
// })
// onMounted(() => {
//   console.log('BasicAvatatEntity onMounted');
// });

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