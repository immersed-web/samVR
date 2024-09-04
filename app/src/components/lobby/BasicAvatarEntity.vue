<template>

  <a-entity interpolated-transform="interpolationTime: 350;" ref="remoteAvatarHead">
    <!-- <Teleport to="#teleport-target-ui-right">
      <div>{{ realTimeData }}</div>
    </Teleport> -->
    <a-entity rotation="0 180 0">
      <a-entity position="0 0 0">
        <a-entity :gltf-model="`url(/avatar/hair/${avatarDesign.parts.hair.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/heads/${avatarDesign.parts.heads.model}.glb)`" />
        <a-entity :gltf-model="`url(/avatar/eyes/${avatarDesign.parts.eyes.model}.glb)`" />
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
import { ref, watch } from 'vue';

const props = defineProps<{
  // realTimeData: Readonly<ClientRealtimeData>
  avatarDesign: NonNullable<NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]['avatarDesign']>
  // avatarDesign: AvatarDesign
  realTimeData: NonNullable<NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]['transform']>
}>();

const remoteAvatarHead = ref<Entity>();

watch(() => props.realTimeData.head, (headTransform) => {
  if (!headTransform.active) return;
  console.log('updating head');
  remoteAvatarHead.value?.emit('moveTo', { position: headTransform.position }, false);
  remoteAvatarHead.value?.emit('rotateTo', { rotation: headTransform.rotation }, false);
})

</script>